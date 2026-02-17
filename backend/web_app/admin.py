from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from .models import (
    User, GameRound, Bet, Transaction,
    ChatMessage, Rain, UserStatistics, MpesaPayment, SystemSettings
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        'phone_number', 'full_name', 'balance_display',
        'bonus_balance', 'is_active', 'date_joined'
    ]
    list_filter = ['is_active', 'is_staff', 'date_joined']
    search_fields = ['phone_number', 'full_name']
    ordering = ['-date_joined']
    readonly_fields = ['id', 'date_joined', 'last_login']

    fieldsets = (
        ('Identity', {'fields': ('id', 'phone_number', 'full_name', 'password')}),
        ('Balance', {'fields': ('balance', 'bonus_balance')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('date_joined', 'last_login')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'full_name', 'password1', 'password2', 'is_staff', 'is_active'),
        }),
    )

    def balance_display(self, obj):
        return f"KES {obj.balance:,.2f}"
    balance_display.short_description = 'Balance'


@admin.register(GameRound)
class GameRoundAdmin(admin.ModelAdmin):
    list_display = ['round_number', 'status_badge', 'multiplier_display', 'start_time', 'end_time']
    list_filter = ['status']
    search_fields = ['round_number']
    ordering = ['-round_number']
    readonly_fields = ['id', 'created_at']

    def status_badge(self, obj):
        colors = {'waiting': 'orange', 'flying': 'blue', 'crashed': 'red'}
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color:white;background:{};padding:2px 8px;border-radius:4px;">{}</span>',
            color, obj.get_status_display()  # Use get_status_display() instead of title()
        )
    status_badge.short_description = 'Status'

    def multiplier_display(self, obj):
        if obj.multiplier is not None:
            # Convert Decimal to float and format
            try:
                # Format the number first as a string
                multiplier_value = float(obj.multiplier)
                # Return as HTML string
                return mark_safe(f'<strong>{multiplier_value:.2f}x</strong>')
            except (TypeError, ValueError):
                return '-'
        return '-'
    multiplier_display.short_description = 'Multiplier'


@admin.register(Bet)
class BetAdmin(admin.ModelAdmin):
    list_display = [
        'user_phone', 'round_number', 'amount_display',
        'cashout_multiplier', 'payout_display', 'status_badge', 'created_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['user__phone_number', 'game_round__round_number']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']

    def user_phone(self, obj):
        return obj.user.phone_number
    user_phone.short_description = 'User'

    def round_number(self, obj):
        return f"#{obj.game_round.round_number}"
    round_number.short_description = 'Round'

    def amount_display(self, obj):
        return f"KES {obj.amount:,.2f}"
    amount_display.short_description = 'Bet Amount'

    def payout_display(self, obj):
        return f"KES {obj.payout:,.2f}" if obj.payout else '-'
    payout_display.short_description = 'Payout'

    def status_badge(self, obj):
        colors = {
            'pending': 'gray', 'active': 'blue',
            'won': 'green', 'lost': 'red', 'cancelled': 'orange'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color:white;background:{};padding:2px 8px;border-radius:4px;">{}</span>',
            color, obj.get_status_display()  # Use get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = [
        'reference', 'user_phone', 'type_badge', 'amount_display',
        'status_badge', 'mpesa_receipt', 'created_at'
    ]
    list_filter = ['transaction_type', 'status', 'created_at']
    search_fields = ['user__phone_number', 'reference', 'mpesa_receipt']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'reference']

    def user_phone(self, obj):
        return obj.user.phone_number
    user_phone.short_description = 'User'

    def amount_display(self, obj):
        return f"KES {obj.amount:,.2f}"
    amount_display.short_description = 'Amount'

    def type_badge(self, obj):
        colors = {
            'deposit': 'green', 'withdrawal': 'red', 'bet': 'blue',
            'win': 'gold', 'bonus': 'purple', 'rain': 'teal', 'refund': 'orange'
        }
        color = colors.get(obj.transaction_type, 'gray')
        return format_html(
            '<span style="color:white;background:{};padding:2px 8px;border-radius:4px;">{}</span>',
            color, obj.get_transaction_type_display()  # Use get_transaction_type_display()
        )
    type_badge.short_description = 'Type'

    def status_badge(self, obj):
        colors = {
            'pending': 'orange', 'completed': 'green',
            'failed': 'red', 'cancelled': 'gray'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color:white;background:{};padding:2px 8px;border-radius:4px;">{}</span>',
            color, obj.get_status_display()  # Use get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(MpesaPayment)
class MpesaPaymentAdmin(admin.ModelAdmin):
    list_display = [
        'user_phone', 'phone_number', 'amount_display',
        'mpesa_receipt_number', 'status_badge', 'created_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['user__phone_number', 'phone_number', 'mpesa_receipt_number', 'checkout_request_id']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']

    def user_phone(self, obj):
        return obj.user.phone_number
    user_phone.short_description = 'User'

    def amount_display(self, obj):
        return f"KES {obj.amount:,.2f}"
    amount_display.short_description = 'Amount'

    def status_badge(self, obj):
        colors = {'pending': 'orange', 'success': 'green', 'failed': 'red'}
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color:white;background:{};padding:2px 8px;border-radius:4px;">{}</span>',
            color, obj.get_status_display()  # Use get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['user_phone', 'message_preview', 'is_system', 'created_at']
    list_filter = ['is_system', 'created_at']
    search_fields = ['user__phone_number', 'message']
    ordering = ['-created_at']

    def user_phone(self, obj):
        return obj.user.phone_number
    user_phone.short_description = 'User'

    def message_preview(self, obj):
        return obj.message[:80]
    message_preview.short_description = 'Message'


@admin.register(UserStatistics)
class UserStatisticsAdmin(admin.ModelAdmin):
    list_display = [
        'user_phone', 'total_bets', 'total_wins',
        'win_rate_display', 'total_wagered_display', 'total_won_display', 'biggest_multiplier'
    ]
    search_fields = ['user__phone_number']
    ordering = ['-total_won']

    def user_phone(self, obj):
        return obj.user.phone_number
    user_phone.short_description = 'User'

    def win_rate_display(self, obj):
        return f"{obj.win_rate:.1f}%"
    win_rate_display.short_description = 'Win Rate'

    def total_wagered_display(self, obj):
        return f"KES {obj.total_wagered:,.2f}"
    total_wagered_display.short_description = 'Total Wagered'

    def total_won_display(self, obj):
        return f"KES {obj.total_won:,.2f}"
    total_won_display.short_description = 'Total Won'


@admin.register(Rain)
class RainAdmin(admin.ModelAdmin):
    list_display = [
        'id_short', 'total_amount', 'amount_per_user',
        'participants_count', 'max_participants', 'status', 'end_time'
    ]
    list_filter = ['status']

    def id_short(self, obj):
        return str(obj.id)[:8]
    id_short.short_description = 'ID'

    def participants_count(self, obj):
        return obj.participants.count()
    participants_count.short_description = 'Joined'


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = ['key', 'value', 'description', 'updated_at']
    search_fields = ['key']