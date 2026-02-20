from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import os
import asyncio

from client import telegram_client, TelegramClientManager
from methods import (
    send_message,
    send_to_channel,
    send_media,
    get_chat_history,
    join_channel,
    get_dialogs,
)

app = FastAPI(title="MetaMill Telegram API")


class ConfigRequest(BaseModel):
    api_id: int
    api_hash: str
    phone: str


class SendMessageRequest(BaseModel):
    receiver: str
    message: str
    parse_mode: Optional[str] = "html"


class SendChannelRequest(BaseModel):
    channel: str
    message: str
    parse_mode: Optional[str] = "html"


class SendMediaRequest(BaseModel):
    receiver: str
    message: Optional[str] = ""
    file_path: str


class GetHistoryRequest(BaseModel):
    entity: str
    limit: Optional[int] = 100


class JoinChannelRequest(BaseModel):
    channel_link: str


class GetDialogsRequest(BaseModel):
    limit: Optional[int] = 100


def get_client() -> TelegramClientManager:
    return telegram_client


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/configure")
async def configure(
    config: ConfigRequest, client: TelegramClientManager = Depends(get_client)
):
    client.configure(config.api_id, config.api_hash, config.phone)
    return {"success": True, "message": "Client configured"}


@app.get("/status")
async def status(client: TelegramClientManager = Depends(get_client)):
    connected = await client.connect()
    authorized = await client.is_authorized() if connected else False
    return {
        "configured": client.is_configured(),
        "connected": connected,
        "authorized": authorized,
    }


@app.post("/send-code")
async def send_code(client: TelegramClientManager = Depends(get_client)):
    if not client.is_configured():
        raise HTTPException(status_code=400, detail="Client not configured")

    try:
        result = await client.send_code_request()
        return {"success": True, "phone_code_hash": result.phone_code_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class SignInRequest(BaseModel):
    code: str
    password: Optional[str] = None


@app.post("/sign-in")
async def sign_in(
    request: SignInRequest, client: TelegramClientManager = Depends(get_client)
):
    try:
        await client.connect()
        result = await client.sign_in(request.code, request.password)
        return {"success": True, "user": {"id": result.id, "username": result.username}}
    except SessionPasswordNeededError:
        raise HTTPException(status_code=400, detail="Password required")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/message")
async def send_msg(
    request: SendMessageRequest, client: TelegramClientManager = Depends(get_client)
):
    await client.connect()
    result = await send_message(
        client.client, request.receiver, request.message, request.parse_mode
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/channel")
async def send_to_ch(
    request: SendChannelRequest, client: TelegramClientManager = Depends(get_client)
):
    await client.connect()
    result = await send_to_channel(
        client.client, request.channel, request.message, request.parse_mode
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/media")
async def send_med(
    request: SendMediaRequest, client: TelegramClientManager = Depends(get_client)
):
    await client.connect()
    result = await send_media(
        client.client, request.receiver, request.message, request.file_path
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/history")
async def get_hist(
    request: GetHistoryRequest, client: TelegramClientManager = Depends(get_client)
):
    await client.connect()
    result = await get_chat_history(client.client, request.entity, request.limit)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/join-channel")
async def join_ch(
    request: JoinChannelRequest, client: TelegramClientManager = Depends(get_client)
):
    await client.connect()
    result = await join_channel(client.client, request.channel_link)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/dialogs")
async def list_dialogs(
    request: GetDialogsRequest, client: TelegramClientManager = Depends(get_client)
):
    await client.connect()
    result = await get_dialogs(client.client, request.limit)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/disconnect")
async def disconnect(client: TelegramClientManager = Depends(get_client)):
    await client.disconnect()
    return {"success": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
