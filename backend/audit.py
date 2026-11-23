from fastapi import Request
from sqlalchemy.orm import Session

from models import AuditLog


def record_audit_event(
    db: Session,
    request: Request,
    action: str,
    *,
    actor_user_id: int | None = None,
    target_user_id: int | None = None,
    target_type: str | None = None,
    target_id: str | int | None = None,
    details: dict[str, object] | None = None,
) -> None:
    client = request.client
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            details=details,
            ip_address=client.host if client else None,
            user_agent=request.headers.get("user-agent", "")[:500] or None,
        )
    )
