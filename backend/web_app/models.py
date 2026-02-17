from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.core.validators import RegexValidator
import uuid


class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError('Phone number is required')
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    phone_regex = RegexValidator(
        regex=r'^\+?254?\d{9,12}$',
        message="Phone number must be in format: '+254712345678'"
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(validators=[phone_regex], max_length=15, unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    bonus_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.phone_number

    def get_total_balance(self):
        return self.balance + self.bonus_balance


class GameRound(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('flying', 'Flying'),
        ('crashed', 'Crashed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    round_number = models.BigIntegerField(unique=True)
    multiplier = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'game_rounds'
        ordering = ['-round_number']
        indexes = [
            models.Index(fields=['-round_number']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Round {self.round_number} - {self.multiplier}x"


class Bet(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('won', 'Won'),
        ('lost', 'Lost'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bets')
    game_round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name='bets')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    cashout_multiplier = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payout = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    auto_cashout = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['game_round', 'status']),
        ]

    def __str__(self):
        return f"{self.user.phone_number} - {self.amount} KES"

    def calculate_payout(self):
        if self.cashout_multiplier:
            return float(self.amount) * float(self.cashout_multiplier)
        return 0.00


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
        ('bet', 'Bet Placed'),
        ('win', 'Win'),
        ('bonus', 'Bonus'),
        ('rain', 'Rain'),
        ('refund', 'Refund'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reference = models.CharField(max_length=100, unique=True)
    mpesa_receipt = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True)
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['reference']),
        ]

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} KES - {self.user.phone_number}"


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    message = models.TextField(max_length=500)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.phone_number}: {self.message[:50]}"


class Rain(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_rains', null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_per_user = models.DecimalField(max_digits=12, decimal_places=2)
    max_participants = models.IntegerField(default=10)
    participants = models.ManyToManyField(User, related_name='rain_participations', blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rains'
        ordering = ['-created_at']

    def is_full(self):
        return self.participants.count() >= self.max_participants

    def is_expired(self):
        return timezone.now() > self.end_time


class UserStatistics(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='statistics')
    total_bets = models.IntegerField(default=0)
    total_wins = models.IntegerField(default=0)
    total_wagered = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    biggest_win = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    biggest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    win_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_statistics'

    def calculate_win_rate(self):
        if self.total_bets > 0:
            self.win_rate = round((self.total_wins / self.total_bets) * 100, 2)
            self.save()


class MpesaPayment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mpesa_payments')
    transaction = models.OneToOneField(Transaction, on_delete=models.CASCADE, related_name='mpesa_payment', null=True)
    phone_number = models.CharField(max_length=15)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    merchant_request_id = models.CharField(max_length=100, blank=True)
    checkout_request_id = models.CharField(max_length=100, blank=True)
    mpesa_receipt_number = models.CharField(max_length=100, blank=True)
    result_code = models.CharField(max_length=10, blank=True)
    result_desc = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mpesa_payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Mpesa - {self.phone_number} - {self.amount} KES"


class SystemSettings(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_settings'

    def __str__(self):
        return self.key