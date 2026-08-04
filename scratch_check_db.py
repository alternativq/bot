import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from db.database import get_session
from db.models import PendingPayment
from sqlalchemy import select

async def run():
    async with get_session() as session:
        pendings = await session.scalars(select(PendingPayment).where(PendingPayment.method_id=='yoomoney_auto'))
        for p in pendings:
            print(f'id={p.id} status={p.status} order={p.order_code} user={p.user_tg_id}')

asyncio.run(run())
