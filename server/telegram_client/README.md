# Telegram Client Service

To run the Telegram client service:

```bash
cd server/telegram_client
pip install -r requirements.txt
python server.py
```

The service runs on port 8001 by default.

## Environment Variables

- `TELEGRAM_API_URL` - URL of the Telegram API service (default: http://localhost:8001)

## API Endpoints

- `GET /health` - Health check
- `GET /status` - Get client status
- `POST /configure` - Configure API credentials
- `POST /send-code` - Send verification code
- `POST /sign-in` - Sign in with code
- `POST /message` - Send message to user
- `POST /channel` - Send message to channel
- `POST /dialogs` - Get list of dialogs
- `POST /history` - Get chat history
- `POST /join-channel` - Join a channel
- `POST /disconnect` - Disconnect client
