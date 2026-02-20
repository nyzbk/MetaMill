from telethon import TelegramClient
from telethon.tl.types import InputPeerUser, InputPeerChannel
from telethon.tl.functions.messages import SendMessageRequest, ImportChatInviteRequest
from telethon.errors import SessionPasswordNeededError
from typing import Optional, List
import asyncio


async def send_message(
    client: TelegramClient, receiver: str, message: str, parse_mode: str = "html"
) -> dict:
    try:
        entity = await client.get_entity(receiver)
        sent = await client.send_message(entity, message, parse_mode=parse_mode)
        return {"success": True, "message_id": sent.id, "chat_id": entity.id}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def send_to_channel(
    client: TelegramClient,
    channel_username: str,
    message: str,
    parse_mode: str = "html",
) -> dict:
    try:
        channel = await client.get_entity(channel_username)
        sent = await client.send_message(channel, message, parse_mode=parse_mode)
        return {"success": True, "message_id": sent.id}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def send_media(
    client: TelegramClient,
    receiver: str,
    message: str,
    file_path: str,
    caption: str = "",
) -> dict:
    try:
        entity = await client.get_entity(receiver)
        sent = await client.send_file(
            entity, file_path, caption=caption, parse_mode="html"
        )
        return {"success": True, "message_id": sent.id}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_chat_history(
    client: TelegramClient, entity_str: str, limit: int = 100
) -> dict:
    try:
        entity = await client.get_entity(entity_str)
        messages = await client.get_messages(entity, limit=limit)
        return {
            "success": True,
            "messages": [
                {
                    "id": m.id,
                    "text": m.text,
                    "date": m.date.isoformat() if m.date else None,
                    "from_id": m.from_id,
                }
                for m in messages
            ],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def join_channel(client: TelegramClient, channel_link: str) -> dict:
    try:
        if channel_link.startswith("https://t.me/"):
            channel_link = channel_link.replace("https://t.me/", "")

        if channel_link.startswith("+"):
            await client(ImportChatInviteRequest(channel_link))
        else:
            await client.get_entity(channel_link)

        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_dialogs(client: TelegramClient, limit: int = 100) -> dict:
    try:
        dialogs = await client.get_dialogs(limit=limit)
        return {
            "success": True,
            "dialogs": [
                {
                    "id": d.entity.id,
                    "title": d.entity.title
                    if hasattr(d.entity, "title")
                    else d.entity.username,
                    "username": d.entity.username
                    if hasattr(d.entity, "username")
                    else None,
                    "type": type(d.entity).__name__,
                }
                for d in dialogs
            ],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
