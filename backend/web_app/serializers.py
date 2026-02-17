from rest_framework import serializers
from django.contrib.auth import authenticate
from decimal import Decimal
from .models import User, GameRound, Bet, Transaction, ChatMessage, Rain, UserStatistics, MpesaPayment


# ─── Auth Serializers ────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['phone_number', 'full_name', 'password', 'confirm_password']

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(**validated_data)
        UserStatistics.objects.get_or_create(user=user)
        return user


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs['phone_number'],
            password=attrs['password']
        )
        if not user:
            raise serializers.ValidationError('Invalid phone number or password.')
        if not user.is_active:
            raise serializers.ValidationError('Your account has been deactivated.')
        attrs['user'] = user
        return attrs


# ─── User Serializers ────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    total_balance = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'phone_number', 'full_name',
            'balance', 'bonus_balance', 'total_balance',
            'date_joined'
        ]
        read_only_fields = ['id', 'balance', 'bonus_balance', 'date_joined']

    def get_total_balance(self, obj):
        return float(obj.get_total_balance())


class UserProfileSerializer(serializers.ModelSerializer):
    total_balance = serializers.SerializerMethodField()
    statistics = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'phone_number', 'full_name',
            'balance', 'bonus_balance', 'total_balance',
            'date_joined', 'statistics'
        ]

    def get_total_balance(self, obj):
        return float(obj.get_total_balance())

    def get_statistics(self, obj):
        try:
            stats = obj.statistics
            return UserStatisticsSerializer(stats).data
        except UserStatistics.DoesNotExist:
            return None


# ─── Game Serializers ────────────────────────────────────────────────────────

class GameRoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameRound
        fields = ['id', 'round_number', 'multiplier', 'status', 'start_time', 'end_time']


class GameRoundHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GameRound
        fields = ['round_number', 'multiplier', 'status', 'end_time']


# ─── Bet Serializers ─────────────────────────────────────────────────────────

class PlaceBetSerializer(serializers.Serializer):
    # coerce_to_string=False ensures validated_data holds Decimal, not a string
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('10'),
        max_value=Decimal('50000'),
        coerce_to_string=False
    )
    auto_cashout = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('1.01'),
        coerce_to_string=False,
        required=False,
        allow_null=True
    )

    def validate_amount(self, value):
        # Force Decimal regardless of what came in (float from JSON, string, etc.)
        return Decimal(str(value))

    def validate_auto_cashout(self, value):
        if value is None:
            return None
        return Decimal(str(value))


class CashoutSerializer(serializers.Serializer):
    bet_id = serializers.UUIDField()
    multiplier = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('1.00'),
        coerce_to_string=False
    )

    def validate_multiplier(self, value):
        return Decimal(str(value))


class BetSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    round_number = serializers.SerializerMethodField()

    class Meta:
        model = Bet
        fields = [
            'id', 'username', 'round_number', 'amount',
            'cashout_multiplier', 'payout', 'status',
            'auto_cashout', 'created_at'
        ]

    def get_username(self, obj):
        phone = obj.user.phone_number
        return phone[-4:] + '****'

    def get_round_number(self, obj):
        return obj.game_round.round_number


class ActiveBetSerializer(serializers.ModelSerializer):
    """Minimal serializer for live game display."""
    username = serializers.SerializerMethodField()

    class Meta:
        model = Bet
        fields = ['id', 'username', 'amount', 'cashout_multiplier', 'status', 'auto_cashout']

    def get_username(self, obj):
        phone = obj.user.phone_number
        return phone[-4:] + '****'


class UserBetSerializer(serializers.ModelSerializer):
    """Full bet info for user's own history."""
    round_number = serializers.SerializerMethodField()
    crash_at = serializers.SerializerMethodField()

    class Meta:
        model = Bet
        fields = [
            'id', 'round_number', 'amount', 'cashout_multiplier',
            'payout', 'status', 'auto_cashout', 'crash_at', 'created_at'
        ]

    def get_round_number(self, obj):
        return obj.game_round.round_number

    def get_crash_at(self, obj):
        return float(obj.game_round.multiplier) if obj.game_round.multiplier else None


# ─── Transaction Serializers ─────────────────────────────────────────────────

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_type', 'amount', 'status',
            'reference', 'mpesa_receipt', 'description',
            'balance_before', 'balance_after', 'created_at'
        ]
        read_only_fields = fields


class DepositSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('10'),
        max_value=Decimal('300000'),
        coerce_to_string=False
    )
    phone_number = serializers.CharField(max_length=15, required=False, allow_blank=True)

    def validate_amount(self, value):
        return Decimal(str(value))

    def validate_phone_number(self, value):
        if value:
            import re
            if not re.match(r'^\+?254?\d{9,12}$', value):
                raise serializers.ValidationError('Invalid phone number format. Use +254XXXXXXXXX')
        return value


class WithdrawSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('100'),
        coerce_to_string=False
    )
    phone_number = serializers.CharField(max_length=15, required=False, allow_blank=True)

    def validate_amount(self, value):
        return Decimal(str(value))


class CompleteDepositSerializer(serializers.Serializer):
    transaction_id = serializers.UUIDField()
    success = serializers.BooleanField(default=True)


# ─── Chat Serializers ────────────────────────────────────────────────────────

class ChatMessageSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['id', 'username', 'message', 'is_system', 'created_at']

    def get_username(self, obj):
        if obj.is_system:
            return 'System'
        phone = obj.user.phone_number
        return phone[-4:] + '****'


class SendChatSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=500, min_length=1)

    def validate_message(self, value):
        return value.strip()


# ─── Rain Serializers ────────────────────────────────────────────────────────

class RainSerializer(serializers.ModelSerializer):
    participants_count = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()
    has_joined = serializers.SerializerMethodField()

    class Meta:
        model = Rain
        fields = [
            'id', 'total_amount', 'amount_per_user',
            'max_participants', 'participants_count', 'status',
            'is_full', 'has_joined', 'start_time', 'end_time'
        ]

    def get_participants_count(self, obj):
        return obj.participants.count()

    def get_is_full(self, obj):
        return obj.is_full()

    def get_has_joined(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.participants.filter(id=request.user.id).exists()
        return False


# ─── Statistics Serializers ──────────────────────────────────────────────────

class UserStatisticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserStatistics
        fields = [
            'total_bets', 'total_wins', 'total_wagered',
            'total_won', 'biggest_win', 'biggest_multiplier', 'win_rate'
        ]


# ─── Leaderboard Serializer ──────────────────────────────────────────────────

class LeaderboardSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    total_won = serializers.SerializerMethodField()
    biggest_win = serializers.SerializerMethodField()
    biggest_multiplier = serializers.SerializerMethodField()
    win_rate = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['username', 'total_won', 'biggest_win', 'biggest_multiplier', 'win_rate']

    def get_username(self, obj):
        phone = obj.phone_number
        return phone[-4:] + '****'

    def get_total_won(self, obj):
        try:
            return float(obj.statistics.total_won)
        except Exception:
            return 0

    def get_biggest_win(self, obj):
        try:
            return float(obj.statistics.biggest_win)
        except Exception:
            return 0

    def get_biggest_multiplier(self, obj):
        try:
            return float(obj.statistics.biggest_multiplier)
        except Exception:
            return 0

    def get_win_rate(self, obj):
        try:
            return float(obj.statistics.win_rate)
        except Exception:
            return 0