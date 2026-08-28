"""FastAPI dependencies: DB session, JWT principal resolution, role guards."""

from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.database import get_db
from app.models.exam import Exam
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_PRIVILEGED_ROLES = {UserRole.dept_head.value, UserRole.admin.value}


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated educator from the bearer JWT."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if not subject:
            raise credentials_exc
        user_id = UUID(str(subject))
    except (jwt.PyJWTError, ValueError):
        raise credentials_exc from None

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exc
    return user


def require_roles(*roles: UserRole):
    """Dependency factory enforcing that the principal holds one of `roles`."""

    async def guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this operation",
            )
        return current_user

    return guard


def can_view_cross_institution(user: User) -> bool:
    """Dept heads and admins may inspect other educators' workspaces."""
    return user.role.value in _PRIVILEGED_ROLES


async def get_owned_exam(db: AsyncSession, exam_id: UUID, user: User) -> Exam:
    """Fetch an exam enforcing multi-tenant institutional isolation."""
    exam = await db.get(Exam, exam_id)
    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
        )
    if exam.user_id != user.user_id and not can_view_cross_institution(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this exam",
        )
    return exam
