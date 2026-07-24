import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR

from modules.DataCleaner import expireAndDeleteOldData
from modules.refreshStatus import update_link_status_from_hubspot


logging.basicConfig(level=logging.INFO)

scheduler = AsyncIOScheduler()


def job_listener(event):
    if event.exception:
        print(f"JOB FAILED: {event.job_id}: {event.exception}")
    else:
        print(f"JOB COMPLETED: {event.job_id}")


scheduler.add_listener(
    job_listener,
    EVENT_JOB_EXECUTED | EVENT_JOB_ERROR
)


testing = False


if testing:
    scheduler.add_job(
        expireAndDeleteOldData,
        trigger="interval",
        minutes=3,
        id="cleanup",
    )

    scheduler.add_job(
        update_link_status_from_hubspot,
        trigger="interval",
        minutes=3,
        id="hubspot",
    )
else:
    scheduler.add_job(
        expireAndDeleteOldData,
        trigger="interval",
        hours=[0, 6, 12, 18],
        id="cleanup",
    )

    scheduler.add_job(
        update_link_status_from_hubspot,
        trigger="interval",
        hours=[1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23],
        id="hubspot",
    )

async def main():
    scheduler.start()

    print("Scheduler started")
    print(scheduler.get_jobs())

    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())