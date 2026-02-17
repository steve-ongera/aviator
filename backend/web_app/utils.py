#utils.py
import uuid
import hashlib
import requests
import base64
from datetime import datetime
from django.conf import settings
from decimal import Decimal


def generate_reference():
    """Generate unique transaction reference"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique = str(uuid.uuid4())[:8].upper()
    return f"AV{timestamp}{unique}"


def process_mpesa_payment(phone_number, amount, account_reference):
    """
    Process M-Pesa STK Push payment
    You need to configure these settings in your Django settings:
    - MPESA_CONSUMER_KEY
    - MPESA_CONSUMER_SECRET
    - MPESA_SHORTCODE
    - MPESA_PASSKEY
    - MPESA_CALLBACK_URL
    - MPESA_ENVIRONMENT (sandbox or production)
    """
    
    try:
        # Get access token
        access_token = get_mpesa_access_token()
        
        if not access_token:
            return {
                'success': False,
                'message': 'Failed to get M-Pesa access token'
            }
        
        # Prepare STK push request
        api_url = get_mpesa_api_url('stkpush')
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        shortcode = settings.MPESA_SHORTCODE
        passkey = settings.MPESA_PASSKEY
        
        # Generate password
        password_str = f"{shortcode}{passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode('utf-8')
        
        # Format phone number
        if phone_number.startswith('0'):
            phone_number = '254' + phone_number[1:]
        elif phone_number.startswith('+'):
            phone_number = phone_number[1:]
        elif not phone_number.startswith('254'):
            phone_number = '254' + phone_number
        
        payload = {
            'BusinessShortCode': shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'TransactionType': 'CustomerPayBillOnline',
            'Amount': int(amount),
            'PartyA': phone_number,
            'PartyB': shortcode,
            'PhoneNumber': phone_number,
            'CallBackURL': settings.MPESA_CALLBACK_URL,
            'AccountReference': account_reference,
            'TransactionDesc': f'Aviator Deposit {account_reference}'
        }
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=30)
        response_data = response.json()
        
        if response.status_code == 200 and response_data.get('ResponseCode') == '0':
            return {
                'success': True,
                'MerchantRequestID': response_data.get('MerchantRequestID'),
                'CheckoutRequestID': response_data.get('CheckoutRequestID'),
                'ResponseDescription': response_data.get('ResponseDescription')
            }
        else:
            return {
                'success': False,
                'message': response_data.get('errorMessage', 'Payment initiation failed')
            }
            
    except Exception as e:
        return {
            'success': False,
            'message': str(e)
        }


def get_mpesa_access_token():
    """Get M-Pesa OAuth access token"""
    try:
        consumer_key = settings.MPESA_CONSUMER_KEY
        consumer_secret = settings.MPESA_CONSUMER_SECRET
        
        api_url = get_mpesa_api_url('oauth')
        
        response = requests.get(
            api_url,
            auth=(consumer_key, consumer_secret),
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json().get('access_token')
        return None
        
    except Exception as e:
        print(f"Error getting access token: {e}")
        return None


def get_mpesa_api_url(endpoint):
    """Get M-Pesa API URL based on environment"""
    environment = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox')
    
    base_urls = {
        'sandbox': 'https://sandbox.safaricom.co.ke',
        'production': 'https://api.safaricom.co.ke'
    }
    
    endpoints = {
        'oauth': '/oauth/v1/generate?grant_type=client_credentials',
        'stkpush': '/mpesa/stkpush/v1/processrequest',
        'stkquery': '/mpesa/stkpushquery/v1/query',
        'b2c': '/mpesa/b2c/v1/paymentrequest'
    }
    
    base_url = base_urls.get(environment, base_urls['sandbox'])
    endpoint_path = endpoints.get(endpoint, '')
    
    return f"{base_url}{endpoint_path}"


def check_mpesa_transaction_status(checkout_request_id):
    """Query M-Pesa STK Push transaction status"""
    try:
        access_token = get_mpesa_access_token()
        
        if not access_token:
            return {
                'success': False,
                'message': 'Failed to get access token'
            }
        
        api_url = get_mpesa_api_url('stkquery')
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        shortcode = settings.MPESA_SHORTCODE
        passkey = settings.MPESA_PASSKEY
        
        password_str = f"{shortcode}{passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode('utf-8')
        
        payload = {
            'BusinessShortCode': shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'CheckoutRequestID': checkout_request_id
        }
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=30)
        return response.json()
        
    except Exception as e:
        return {
            'success': False,
            'message': str(e)
        }


def process_b2c_withdrawal(phone_number, amount, occasion='Withdrawal'):
    """
    Process M-Pesa B2C withdrawal
    This requires additional M-Pesa B2C configuration
    """
    try:
        access_token = get_mpesa_access_token()
        
        if not access_token:
            return {
                'success': False,
                'message': 'Failed to get access token'
            }
        
        api_url = get_mpesa_api_url('b2c')
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Format phone number
        if phone_number.startswith('0'):
            phone_number = '254' + phone_number[1:]
        elif phone_number.startswith('+'):
            phone_number = phone_number[1:]
        
        payload = {
            'InitiatorName': settings.MPESA_INITIATOR_NAME,
            'SecurityCredential': settings.MPESA_SECURITY_CREDENTIAL,
            'CommandID': 'BusinessPayment',
            'Amount': int(amount),
            'PartyA': settings.MPESA_SHORTCODE,
            'PartyB': phone_number,
            'Remarks': occasion,
            'QueueTimeOutURL': settings.MPESA_B2C_TIMEOUT_URL,
            'ResultURL': settings.MPESA_B2C_RESULT_URL,
            'Occasion': occasion
        }
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=30)
        response_data = response.json()
        
        if response.status_code == 200 and response_data.get('ResponseCode') == '0':
            return {
                'success': True,
                'ConversationID': response_data.get('ConversationID'),
                'OriginatorConversationID': response_data.get('OriginatorConversationID')
            }
        else:
            return {
                'success': False,
                'message': response_data.get('errorMessage', 'Withdrawal failed')
            }
            
    except Exception as e:
        return {
            'success': False,
            'message': str(e)
        }


def mask_phone_number(phone_number):
    """Mask phone number for privacy"""
    if len(phone_number) <= 4:
        return phone_number
    return phone_number[-4:] + '****'


def calculate_multiplier(elapsed_time):
    """
    Calculate aviator multiplier based on elapsed time
    This is a simple implementation - you can customize the curve
    """
    # Base multiplier calculation
    # Example: multiplier grows exponentially with time
    # Adjust these values to match your game mechanics
    
    import math
    
    # Multiplier = 1.00 + (time_in_seconds * growth_rate) ^ exponent
    growth_rate = 0.05
    exponent = 1.1
    
    multiplier = 1.00 + (elapsed_time * growth_rate) ** exponent
    
    return round(multiplier, 2)


def determine_crash_point():
    """
    Determine when the plane will crash
    This should use a provably fair algorithm
    For demo purposes, using a simple random approach
    """
    import random
    
    # Generate crash multiplier between 1.00x and 100.00x
    # Weighted towards lower multipliers for house edge
    
    rand = random.random()
    
    if rand < 0.30:  # 30% chance of crash below 2x
        return round(random.uniform(1.00, 2.00), 2)
    elif rand < 0.60:  # 30% chance between 2x-5x
        return round(random.uniform(2.00, 5.00), 2)
    elif rand < 0.85:  # 25% chance between 5x-10x
        return round(random.uniform(5.00, 10.00), 2)
    elif rand < 0.95:  # 10% chance between 10x-20x
        return round(random.uniform(10.00, 20.00), 2)
    else:  # 5% chance above 20x
        return round(random.uniform(20.00, 100.00), 2)


def generate_provably_fair_result(server_seed, client_seed, nonce):
    """
    Generate provably fair game result
    This ensures transparency and fairness
    """
    # Combine seeds with nonce
    combined = f"{server_seed}:{client_seed}:{nonce}"
    
    # Generate hash
    hash_result = hashlib.sha256(combined.encode()).hexdigest()
    
    # Convert first 8 characters to integer
    hex_value = int(hash_result[:8], 16)
    
    # Normalize to 0-1 range
    normalized = hex_value / (16**8)
    
    # Calculate multiplier (house edge of ~3%)
    house_edge = 0.97
    crash_point = (100 / (1 - normalized)) * house_edge / 100
    
    # Ensure minimum and maximum values
    crash_point = max(1.00, min(crash_point, 1000.00))
    
    return round(crash_point, 2)