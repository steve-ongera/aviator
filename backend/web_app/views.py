from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction as db_transaction
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal
import uuid

from .models import (
    User, GameRound, Bet, Transaction,
    ChatMessage, Rain, UserStatistics, MpesaPayment
)
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer, UserProfileSerializer,
    GameRoundSerializer, GameRoundHistorySerializer,
    PlaceBetSerializer, CashoutSerializer, BetSerializer,
    ActiveBetSerializer, UserBetSerializer,
    TransactionSerializer, DepositSerializer, WithdrawSerializer, CompleteDepositSerializer,
    ChatMessageSerializer, SendChatSerializer,
    RainSerializer, UserStatisticsSerializer, LeaderboardSerializer
)


def generate_reference():
    timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
    unique = uuid.uuid4().hex[:8].upper()
    return f"AV{timestamp}{unique}"


def generate_mpesa_receipt():
    return f"QGH{uuid.uuid4().hex[:8].upper()}"


# ─── Auth ────────────────────────────────────────────────────────────────────

class AuthViewSet(viewsets.GenericViewSet):
    """
    Authentication endpoints:
    - POST /auth/register/
    - POST /auth/login/
    - POST /auth/logout/
    - GET  /auth/me/
    """
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        if self.action == 'register':
            return RegisterSerializer
        if self.action == 'login':
            return LoginSerializer
        return UserSerializer

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with db_transaction.atomic():
            user = serializer.save()

            # Welcome bonus
            welcome_bonus = Decimal('50.00')
            user.bonus_balance = welcome_bonus
            user.save()

            Transaction.objects.create(
                user=user,
                transaction_type='bonus',
                amount=welcome_bonus,
                status='completed',
                reference=generate_reference(),
                description='Welcome bonus',
                balance_before=Decimal('0.00'),
                balance_after=welcome_bonus
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'success': True,
            'message': 'Registration successful. Welcome bonus of KES 50 added!',
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'success': True,
            'message': 'Login successful',
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'user': UserSerializer(user).data
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def logout(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass
        return Response({'success': True, 'message': 'Logged out successfully'})

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        # Always fetch fresh from DB
        user = User.objects.get(id=request.user.id)
        return Response({
            'success': True,
            'user': UserProfileSerializer(user).data
        })

    @action(detail=False, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def update_profile(self, request):
        user = request.user
        allowed_fields = ['full_name']
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        serializer = UserSerializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({'success': True, 'user': serializer.data})


# ─── Game ────────────────────────────────────────────────────────────────────

class GameViewSet(viewsets.GenericViewSet):
    """
    Game endpoints:
    - GET  /game/current/          → current round + live bets
    - GET  /game/history/          → last N crashed rounds
    - POST /game/bet/              → place a bet
    - POST /game/cashout/          → cashout a bet
    - GET  /game/my-bet/           → user's active bet this round
    - GET  /game/my-history/       → user's bet history
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Return the current waiting/flying round plus all active bets on it."""
        current_round = GameRound.objects.filter(
            Q(status='waiting') | Q(status='flying')
        ).first()

        if not current_round:
            return Response({'success': True, 'round': None})

        bets = Bet.objects.filter(
            game_round=current_round,
            status__in=['pending', 'active', 'won']
        ).select_related('user').order_by('-amount')

        # Check if current user has a bet
        user_bet = bets.filter(user=request.user).first()

        return Response({
            'success': True,
            'round': {
                'id': str(current_round.id),
                'round_number': current_round.round_number,
                'status': current_round.status,
                'multiplier': float(current_round.multiplier) if current_round.multiplier else 1.00,
                'start_time': current_round.start_time.isoformat(),
            },
            'bets': ActiveBetSerializer(bets, many=True).data,
            'user_bet': ActiveBetSerializer(user_bet).data if user_bet else None
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Return last 20 crashed rounds for the multiplier history bar."""
        limit = min(int(request.query_params.get('limit', 20)), 50)
        rounds = GameRound.objects.filter(status='crashed').order_by('-round_number')[:limit]

        return Response({
            'success': True,
            'history': GameRoundHistorySerializer(rounds, many=True).data
        })

    @action(detail=False, methods=['post'])
    def bet(self, request):
        """Place a bet on the current waiting round."""
        serializer = PlaceBetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data['amount']
        auto_cashout = serializer.validated_data.get('auto_cashout')
        user = request.user

        with db_transaction.atomic():
            # Lock user row
            user = User.objects.select_for_update().get(id=request.user.id)

            # Balance check
            total_balance = user.get_total_balance()
            if total_balance < amount:
                return Response({
                    'success': False,
                    'message': f'Insufficient balance. You have KES {total_balance:.2f}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get current waiting round
            current_round = GameRound.objects.filter(status='waiting').first()
            if not current_round:
                return Response({
                    'success': False,
                    'message': 'No round accepting bets right now. Wait for the next round.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # No duplicate bets
            if Bet.objects.filter(
                user=user,
                game_round=current_round,
                status__in=['pending', 'active']
            ).exists():
                return Response({
                    'success': False,
                    'message': 'You already have an active bet in this round.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Deduct balance (bonus first)
            balance_before = total_balance
            if user.bonus_balance >= amount:
                user.bonus_balance -= amount
            elif user.balance >= amount:
                user.balance -= amount
            else:
                remaining = amount - user.bonus_balance
                user.bonus_balance = Decimal('0.00')
                user.balance -= remaining
            user.save()

            # Create bet
            bet = Bet.objects.create(
                user=user,
                game_round=current_round,
                amount=amount,
                auto_cashout=auto_cashout,
                status='pending'
            )

            # Transaction record
            Transaction.objects.create(
                user=user,
                transaction_type='bet',
                amount=amount,
                status='completed',
                reference=generate_reference(),
                description=f'Bet placed on round #{current_round.round_number}',
                balance_before=balance_before,
                balance_after=user.get_total_balance()
            )

            # Update stats
            stats, _ = UserStatistics.objects.get_or_create(user=user)
            stats.total_bets += 1
            stats.total_wagered += amount
            stats.save()

        return Response({
            'success': True,
            'message': 'Bet placed!',
            'bet': ActiveBetSerializer(bet).data,
            'balance': float(user.balance),
            'bonus_balance': float(user.bonus_balance),
            'total_balance': float(user.get_total_balance())
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def cashout(self, request):
        """Cashout an active bet at the current multiplier."""
        serializer = CashoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bet_id = serializer.validated_data['bet_id']
        sent_multiplier = serializer.validated_data['multiplier']

        with db_transaction.atomic():
            # Get the bet
            try:
                bet = Bet.objects.select_related('game_round').select_for_update().get(
                    id=bet_id,
                    user=request.user,
                    status__in=['pending', 'active']
                )
            except Bet.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Bet not found or already settled.'
                }, status=status.HTTP_404_NOT_FOUND)

            # Round must be flying
            if bet.game_round.status != 'flying':
                if bet.game_round.status == 'crashed':
                    bet.status = 'lost'
                    bet.save()
                return Response({
                    'success': False,
                    'message': 'Round has ended. Too late to cash out!'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Use round's authoritative multiplier (with small tolerance for latency)
            round_multiplier = bet.game_round.multiplier or Decimal('1.00')
            if abs(sent_multiplier - round_multiplier) > Decimal('0.15'):
                cashout_multiplier = round_multiplier
            else:
                cashout_multiplier = sent_multiplier

            # Calculate and pay out
            payout = bet.amount * cashout_multiplier
            bet.cashout_multiplier = cashout_multiplier
            bet.payout = payout
            bet.status = 'won'
            bet.save()

            user = User.objects.select_for_update().get(id=request.user.id)
            balance_before = user.get_total_balance()
            user.balance += payout
            user.save()

            Transaction.objects.create(
                user=user,
                transaction_type='win',
                amount=payout,
                status='completed',
                reference=generate_reference(),
                description=f'Cashout at {cashout_multiplier}x on round #{bet.game_round.round_number}',
                balance_before=balance_before,
                balance_after=user.get_total_balance()
            )

            # Update stats
            stats, _ = UserStatistics.objects.get_or_create(user=user)
            stats.total_wins += 1
            stats.total_won += payout
            if payout > stats.biggest_win:
                stats.biggest_win = payout
            if cashout_multiplier > stats.biggest_multiplier:
                stats.biggest_multiplier = cashout_multiplier
            stats.calculate_win_rate()

        return Response({
            'success': True,
            'message': f'Cashed out at {cashout_multiplier}x!',
            'payout': float(payout),
            'multiplier': float(cashout_multiplier),
            'balance': float(user.balance),
            'bonus_balance': float(user.bonus_balance),
            'total_balance': float(user.get_total_balance())
        })

    @action(detail=False, methods=['get'])
    def my_bet(self, request):
        """Return the user's active bet in the current round."""
        current_round = GameRound.objects.filter(
            Q(status='waiting') | Q(status='flying')
        ).first()

        if not current_round:
            return Response({'success': True, 'bet': None})

        bet = Bet.objects.filter(
            user=request.user,
            game_round=current_round,
            status__in=['pending', 'active']
        ).first()

        return Response({
            'success': True,
            'bet': ActiveBetSerializer(bet).data if bet else None
        })

    @action(detail=False, methods=['get'])
    def my_history(self, request):
        """User's own bet history with pagination."""
        limit = min(int(request.query_params.get('limit', 20)), 50)
        offset = int(request.query_params.get('offset', 0))

        bets = Bet.objects.filter(user=request.user).select_related('game_round').order_by('-created_at')
        total = bets.count()
        page = bets[offset:offset + limit]

        return Response({
            'success': True,
            'total': total,
            'bets': UserBetSerializer(page, many=True).data,
            'has_more': total > (offset + limit)
        })


# ─── Transactions ─────────────────────────────────────────────────────────────

class TransactionViewSet(viewsets.GenericViewSet):
    """
    - GET  /transactions/          → user's transaction history
    - POST /transactions/deposit/  → initiate deposit
    - POST /transactions/complete_deposit/ → confirm deposit (simulated)
    - POST /transactions/withdraw/ → request withdrawal
    - GET  /transactions/balance/  → current balance
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def list_transactions(self, request):
        limit = min(int(request.query_params.get('limit', 20)), 100)
        offset = int(request.query_params.get('offset', 0))
        tx_type = request.query_params.get('type')

        qs = Transaction.objects.filter(user=request.user)
        if tx_type:
            qs = qs.filter(transaction_type=tx_type)

        total = qs.count()
        page = qs.order_by('-created_at')[offset:offset + limit]

        return Response({
            'success': True,
            'total': total,
            'transactions': TransactionSerializer(page, many=True).data,
            'has_more': total > (offset + limit)
        })

    @action(detail=False, methods=['get'])
    def balance(self, request):
        user = User.objects.get(id=request.user.id)
        return Response({
            'success': True,
            'balance': float(user.balance),
            'bonus_balance': float(user.bonus_balance),
            'total_balance': float(user.get_total_balance())
        })

    @action(detail=False, methods=['post'])
    def deposit(self, request):
        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data['amount']
        phone_number = serializer.validated_data.get('phone_number') or request.user.phone_number

        with db_transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            transaction_ref = generate_reference()
            current_balance = user.get_total_balance()

            transaction_record = Transaction.objects.create(
                user=user,
                transaction_type='deposit',
                amount=amount,
                status='pending',
                reference=transaction_ref,
                description=f'M-Pesa deposit of KES {amount}',
                balance_before=current_balance,
                balance_after=current_balance
            )

            checkout_request_id = f"ws_CO_{uuid.uuid4().hex[:20]}"
            merchant_request_id = f"merchant_{uuid.uuid4().hex[:15]}"

            mpesa_payment = MpesaPayment.objects.create(
                user=user,
                transaction=transaction_record,
                phone_number=phone_number,
                amount=amount,
                merchant_request_id=merchant_request_id,
                checkout_request_id=checkout_request_id,
                status='pending'
            )

        return Response({
            'success': True,
            'message': f'STK push sent to {phone_number}. Confirm payment.',
            'transaction_id': str(transaction_record.id),
            'checkout_request_id': checkout_request_id,
            'merchant_request_id': merchant_request_id
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def complete_deposit(self, request):
        """Simulate M-Pesa callback / complete a pending deposit."""
        serializer = CompleteDepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction_id = serializer.validated_data['transaction_id']
        is_success = serializer.validated_data['success']

        with db_transaction.atomic():
            try:
                transaction_record = Transaction.objects.select_for_update().get(
                    id=transaction_id,
                    user=request.user,
                    status='pending'
                )
            except Transaction.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Transaction not found or already processed.'
                }, status=status.HTTP_404_NOT_FOUND)

            mpesa_payment = MpesaPayment.objects.select_for_update().get(
                transaction=transaction_record
            )
            user = User.objects.select_for_update().get(id=request.user.id)

            if is_success:
                mpesa_receipt = generate_mpesa_receipt()
                old_balance = user.balance

                user.balance = old_balance + transaction_record.amount
                user.save()

                transaction_record.status = 'completed'
                transaction_record.mpesa_receipt = mpesa_receipt
                transaction_record.balance_before = old_balance
                transaction_record.balance_after = user.balance
                transaction_record.save()

                mpesa_payment.status = 'success'
                mpesa_payment.mpesa_receipt_number = mpesa_receipt
                mpesa_payment.result_code = '0'
                mpesa_payment.result_desc = 'The service request is processed successfully.'
                mpesa_payment.save()

                return Response({
                    'success': True,
                    'message': f'Deposit of KES {transaction_record.amount} confirmed!',
                    'amount': float(transaction_record.amount),
                    'mpesa_receipt': mpesa_receipt,
                    'new_balance': float(user.get_total_balance())
                })
            else:
                transaction_record.status = 'failed'
                transaction_record.save()
                mpesa_payment.status = 'failed'
                mpesa_payment.result_code = '1'
                mpesa_payment.result_desc = 'Transaction cancelled by user.'
                mpesa_payment.save()

                return Response({
                    'success': False,
                    'message': 'Deposit cancelled or failed.'
                }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def withdraw(self, request):
        serializer = WithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data['amount']
        phone_number = serializer.validated_data.get('phone_number') or request.user.phone_number

        with db_transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)

            if user.balance < amount:
                return Response({
                    'success': False,
                    'message': f'Insufficient balance. Main balance: KES {user.balance:.2f}'
                }, status=status.HTTP_400_BAD_REQUEST)

            balance_before = user.get_total_balance()
            user.balance -= amount
            user.save()

            transaction_record = Transaction.objects.create(
                user=user,
                transaction_type='withdrawal',
                amount=amount,
                status='completed',  # Auto-complete for now; use pending for manual review
                reference=generate_reference(),
                description=f'Withdrawal to {phone_number}',
                balance_before=balance_before,
                balance_after=user.get_total_balance()
            )

        return Response({
            'success': True,
            'message': f'Withdrawal of KES {amount} processed successfully.',
            'reference': transaction_record.reference,
            'balance': float(user.balance),
            'total_balance': float(user.get_total_balance())
        })

    @action(detail=False, methods=['get'])
    def check_deposit_status(self, request):
        transaction_id = request.query_params.get('transaction_id')
        if not transaction_id:
            return Response({'success': False, 'message': 'transaction_id required'}, status=400)

        try:
            txn = Transaction.objects.get(id=transaction_id, user=request.user)
            mpesa = MpesaPayment.objects.get(transaction=txn)
            return Response({
                'success': True,
                'status': txn.status,
                'mpesa_status': mpesa.status,
                'amount': float(txn.amount),
                'mpesa_receipt': txn.mpesa_receipt or ''
            })
        except Transaction.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatViewSet(viewsets.GenericViewSet):
    """
    - GET  /chat/messages/    → recent 50 messages
    - POST /chat/send/        → send a message
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def messages(self, request):
        limit = min(int(request.query_params.get('limit', 50)), 100)
        messages = ChatMessage.objects.select_related('user').order_by('-created_at')[:limit]
        messages = list(reversed(messages))
        return Response({
            'success': True,
            'messages': ChatMessageSerializer(messages, many=True).data
        })

    @action(detail=False, methods=['post'])
    def send(self, request):
        serializer = SendChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        chat_message = ChatMessage.objects.create(
            user=request.user,
            message=serializer.validated_data['message']
        )

        return Response({
            'success': True,
            'message': ChatMessageSerializer(chat_message).data
        }, status=status.HTTP_201_CREATED)


# ─── Rain ─────────────────────────────────────────────────────────────────────

class RainViewSet(viewsets.GenericViewSet):
    """
    - GET  /rain/active/   → active rains
    - POST /rain/join/     → join a rain
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def active(self, request):
        rains = Rain.objects.filter(
            status='active',
            end_time__gt=timezone.now()
        ).prefetch_related('participants')

        return Response({
            'success': True,
            'rains': RainSerializer(rains, many=True, context={'request': request}).data
        })

    @action(detail=False, methods=['post'])
    def join(self, request):
        rain_id = request.data.get('rain_id')
        if not rain_id:
            return Response({'success': False, 'message': 'rain_id required'}, status=400)

        try:
            rain = Rain.objects.get(id=rain_id, status='active')
        except Rain.DoesNotExist:
            return Response({'success': False, 'message': 'Rain not found'}, status=404)

        if rain.is_expired():
            return Response({'success': False, 'message': 'Rain has expired'}, status=400)
        if rain.is_full():
            return Response({'success': False, 'message': 'Rain is full'}, status=400)
        if rain.participants.filter(id=request.user.id).exists():
            return Response({'success': False, 'message': 'Already joined this rain'}, status=400)

        with db_transaction.atomic():
            rain.participants.add(request.user)

            if rain.is_full():
                rain.status = 'completed'
                rain.save()

                for participant in rain.participants.all():
                    balance_before = participant.get_total_balance()
                    participant.bonus_balance += rain.amount_per_user
                    participant.save()

                    Transaction.objects.create(
                        user=participant,
                        transaction_type='rain',
                        amount=rain.amount_per_user,
                        status='completed',
                        reference=generate_reference(),
                        description='Rain bonus received',
                        balance_before=balance_before,
                        balance_after=participant.get_total_balance()
                    )

        return Response({'success': True, 'message': 'Joined rain successfully!'})


# ─── Leaderboard ──────────────────────────────────────────────────────────────

class LeaderboardViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def top(self, request):
        limit = min(int(request.query_params.get('limit', 10)), 50)
        users = User.objects.filter(
            is_staff=False,
            statistics__isnull=False
        ).select_related('statistics').order_by('-statistics__total_won')[:limit]

        return Response({
            'success': True,
            'leaders': LeaderboardSerializer(users, many=True).data
        })