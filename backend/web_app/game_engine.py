"""
game_engine.py
Aviator Game Engine
Manages game rounds, multiplier calculation, and game state
Run this as a separate process or Django management command
"""

import time
import random
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from .models import GameRound, Bet, User, Transaction, ChatMessage, UserStatistics
from .utils import determine_crash_point, generate_reference


class AviatorGameEngine:
    """Main game engine that controls game flow"""
    
    def __init__(self):
        self.current_round = None
        self.round_counter = self.get_last_round_number() + 1
        self.multiplier = Decimal('1.00')
        self.crash_point = None
        self.game_speed = 0.1  # Update every 0.1 seconds
        
    def get_last_round_number(self):
        """Get the last round number from database"""
        last_round = GameRound.objects.order_by('-round_number').first()
        return last_round.round_number if last_round else 0
    
    def create_new_round(self):
        """Create a new game round"""
        self.crash_point = Decimal(str(determine_crash_point()))
        
        self.current_round = GameRound.objects.create(
            round_number=self.round_counter,
            status='waiting',
            multiplier=Decimal('1.00')
        )
        
        self.round_counter += 1
        self.multiplier = Decimal('1.00')
        
        print(f"New round {self.current_round.round_number} created. Crash point: {self.crash_point}x")
        
        # Send system message
        ChatMessage.objects.create(
            user=User.objects.first(),  # System user
            message=f"New round #{self.current_round.round_number} starting!",
            is_system=True
        )
    
    def waiting_phase(self, duration=5):
        """Waiting phase before round starts"""
        print(f"Waiting for {duration} seconds...")
        time.sleep(duration)
        
        # Activate all pending bets
        with transaction.atomic():
            pending_bets = Bet.objects.filter(
                game_round=self.current_round,
                status='pending'
            )
            
            pending_bets.update(status='active')
            
            print(f"Activated {pending_bets.count()} bets for round {self.current_round.round_number}")
    
    def flying_phase(self):
        """Flying phase where multiplier increases"""
        self.current_round.status = 'flying'
        self.current_round.start_time = timezone.now()
        self.current_round.save()
        
        print(f"Round {self.current_round.round_number} is now flying!")
        
        start_time = time.time()
        
        while self.multiplier < self.crash_point:
            # Calculate elapsed time
            elapsed = time.time() - start_time
            
            # Calculate multiplier based on time
            # Formula: multiplier grows exponentially
            self.multiplier = self.calculate_multiplier(elapsed)
            
            # Update round multiplier in database
            self.current_round.multiplier = self.multiplier
            self.current_round.save(update_fields=['multiplier'])
            
            # Check for auto-cashouts
            self.process_auto_cashouts()
            
            # Sleep for game speed
            time.sleep(self.game_speed)
        
        # Crash the plane
        self.crash_plane()
    
    def calculate_multiplier(self, elapsed_time):
        """Calculate multiplier based on elapsed time"""
        # Exponential growth formula
        # Adjust these parameters to control game speed and feel
        base = Decimal('1.00')
        growth_rate = Decimal('0.08')  # Controls how fast multiplier grows
        exponent = Decimal('1.15')  # Controls acceleration
        
        multiplier = base + ((Decimal(str(elapsed_time)) * growth_rate) ** exponent)
        
        return min(multiplier, self.crash_point)
    
    def process_auto_cashouts(self):
        """Process auto-cashouts for active bets"""
        with transaction.atomic():
            auto_cashout_bets = Bet.objects.filter(
                game_round=self.current_round,
                status='active',
                auto_cashout__lte=self.multiplier
            ).select_related('user')
            
            for bet in auto_cashout_bets:
                self.cashout_bet(bet, bet.auto_cashout)
    
    def cashout_bet(self, bet, multiplier):
        """Process cashout for a bet"""
        bet.cashout_multiplier = multiplier
        bet.payout = Decimal(str(bet.calculate_payout()))
        bet.status = 'won'
        bet.save()
        
        # Credit user balance
        user = bet.user
        balance_before = user.get_total_balance()
        user.balance += bet.payout
        user.save()
        
        # Create transaction
        Transaction.objects.create(
            user=user,
            transaction_type='win',
            amount=bet.payout,
            status='completed',
            reference=generate_reference(),
            description=f'Win from round {self.current_round.round_number}',
            balance_before=balance_before,
            balance_after=user.get_total_balance()
        )
        
        # Update statistics
        stats, created = UserStatistics.objects.get_or_create(user=user)
        stats.total_wins += 1
        stats.total_won += bet.payout
        
        if bet.payout > stats.biggest_win:
            stats.biggest_win = bet.payout
        
        if multiplier > stats.biggest_multiplier:
            stats.biggest_multiplier = multiplier
        
        stats.calculate_win_rate()
        stats.save()
        
        print(f"Auto-cashed out {user.phone_number} at {multiplier}x for {bet.payout} KES")
    
    def crash_plane(self):
        """Crash the plane and end the round"""
        self.current_round.status = 'crashed'
        self.current_round.end_time = timezone.now()
        self.current_round.multiplier = self.crash_point
        self.current_round.save()
        
        print(f"Round {self.current_round.round_number} crashed at {self.crash_point}x")
        
        # Process all remaining active bets as lost
        with transaction.atomic():
            lost_bets = Bet.objects.filter(
                game_round=self.current_round,
                status='active'
            ).select_related('user')
            
            for bet in lost_bets:
                bet.status = 'lost'
                bet.save()
                
                # Update statistics
                stats, created = UserStatistics.objects.get_or_create(user=bet.user)
                stats.calculate_win_rate()
                stats.save()
            
            print(f"Marked {lost_bets.count()} bets as lost")
        
        # Send system message
        ChatMessage.objects.create(
            user=User.objects.first(),
            message=f"Round #{self.current_round.round_number} flew away at {self.crash_point}x!",
            is_system=True
        )
    
    def run(self):
        """Main game loop"""
        print("Aviator Game Engine Started!")
        
        try:
            while True:
                # Create new round
                self.create_new_round()
                
                # Waiting phase (5 seconds for players to place bets)
                self.waiting_phase(duration=5)
                
                # Flying phase
                self.flying_phase()
                
                # Short pause before next round
                time.sleep(2)
                
        except KeyboardInterrupt:
            print("\nGame engine stopped by user")
        except Exception as e:
            print(f"Error in game engine: {e}")
            import traceback
            traceback.print_exc()


# Django Management Command to run the game engine
# Save this as: management/commands/run_game_engine.py

"""
from django.core.management.base import BaseCommand
from aviator.game_engine import AviatorGameEngine


class Command(BaseCommand):
    help = 'Run the Aviator game engine'

    def handle(self, *args, **options):
        engine = AviatorGameEngine()
        self.stdout.write(self.style.SUCCESS('Starting Aviator Game Engine...'))
        engine.run()
"""


if __name__ == '__main__':
    # For testing purposes
    engine = AviatorGameEngine()
    engine.run()