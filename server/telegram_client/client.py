from telethon import TelegramClient
from typing import Optional
import os


class TelegramClientManager:
    def __init__(self, session_name: str = "metamill"):
        self.session_name = session_name
        self.client: Optional[TelegramClient] = None
        self.api_id: Optional[int] = None
        self.api_hash: Optional[str] = None
        self.phone: Optional[str] = None

    def configure(self, api_id: int, api_hash: str, phone: str):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone

    def is_configured(self) -> bool:
        return (
            self.api_id is not None
            and self.api_hash is not None
            and self.phone is not None
        )

    async def connect(self) -> bool:
        if not self.is_configured():
            return False

        if self.client is None:
            self.client = TelegramClient(self.session_name, self.api_id, self.api_hash)

        if not self.client.is_connected():
            await self.client.connect()

        return await self.client.is_connected()

    async def disconnect(self):
        if self.client and self.client.is_connected():
            await self.client.disconnect()

    async def send_code_request(self):
        if not self.is_configured():
            raise ValueError("Client not configured")

        if self.client is None:
            await self.connect()

        return await self.client.send_code_request(self.phone)

    async def sign_in(self, code: str, password: Optional[str] = None):
        if not self.client:
            raise ValueError("Client not connected")

        if password:
            return await self.client.sign_in(password=password)
        else:
            return await self.client.sign_in(self.phone, code)

    async def get_me(self):
        if not self.client:
            raise ValueError("Client not connected")
        return await self.client.get_me()

    async def is_authorized(self) -> bool:
        try:
            if not self.client:
                return False
            await self.client.get_me()
            return True
        except:
            return False


telegram_client = TelegramClientManager()
