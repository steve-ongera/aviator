from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # Django admin (for staff)
    path('admin/', admin.site.urls),

    # All Aviator API endpoints under /api/
    path('api/', include('web_app.urls')),

    # JWT token utilities
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
]

# ─── settings.py additions needed ───────────────────────────────────────────
#
# INSTALLED_APPS = [
#     ...
#     'rest_framework',
#     'rest_framework_simplejwt',
#     'rest_framework_simplejwt.token_blacklist',
#     'corsheaders',
#     'channels',        # for WebSocket (game engine)
#     'aviator',
# ]
#
# MIDDLEWARE = [
#     'corsheaders.middleware.CorsMiddleware',
#     ...
# ]
#
# REST_FRAMEWORK = {
#     'DEFAULT_AUTHENTICATION_CLASSES': (
#         'rest_framework_simplejwt.authentication.JWTAuthentication',
#     ),
#     'DEFAULT_PERMISSION_CLASSES': (
#         'rest_framework.permissions.IsAuthenticated',
#     ),
#     'DEFAULT_RENDERER_CLASSES': (
#         'rest_framework.renderers.JSONRenderer',
#     ),
# }
#
# from datetime import timedelta
# SIMPLE_JWT = {
#     'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
#     'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
#     'ROTATE_REFRESH_TOKENS': True,
#     'BLACKLIST_AFTER_ROTATION': True,
#     'AUTH_HEADER_TYPES': ('Bearer',),
# }
#
# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:3000",    # React dev server
#     "http://localhost:5173",    # Vite dev server
# ]
# CORS_ALLOW_CREDENTIALS = True
#
# AUTH_USER_MODEL = 'aviator.User'
#
# # Channels (WebSocket for real-time game)
# ASGI_APPLICATION = 'myproject.asgi.application'
# CHANNEL_LAYERS = {
#     'default': {
#         'BACKEND': 'channels_redis.core.RedisChannelLayer',
#         'CONFIG': {'hosts': [('127.0.0.1', 6379)]},
#     }
# }