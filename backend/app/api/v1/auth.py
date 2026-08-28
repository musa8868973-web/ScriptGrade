"""Authentication contracts (PRD endpoints #1 signup / #2 login — Page 1).

Login accepts BOTH the PRD JSON body (`{"email", "password"}`) and the
standard OAuth2 password form so `OAuth2PasswordBearer` tooling works.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.schemas.auth import SignupRequest, SignupResponse, TokenResponse, TokenUser

router = APIRouter()


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new educator account",
)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)) -> SignupResponse:
    """Create the educator workspace; rejects duplicate emails."""
    existing = await db.execute(
        select(User.user_id).where(func.lower(User.email) == payload.email.lower())
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        institution_name=payload.institution_name.strip(),
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    return SignupResponse(status="success", user_id=user.user_id)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and issue a JWT bearer token",
)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate an educator and return the signed session token."""
    content_type = request.headers.get("content-type", "")
    resolved_email: str | None = None
    resolved_password: str | None = None

    if content_type.startswith("application/json"):
        try:
            body = await request.json()
        except Exception as exc:  # noqa: BLE001 — malformed JSON is a client error
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid JSON body",
            ) from exc
        resolved_email = body.get("email") if isinstance(body, dict) else None
        resolved_password = body.get("password") if isinstance(body, dict) else None
    else:
        form = await request.form()
        resolved_email = form.get("email")
        resolved_password = form.get("password")

    if not resolved_email or not resolved_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'email' and 'password' are required",
        )

    result = await db.execute(
        select(User).where(func.lower(User.email) == resolved_email.lower())
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(resolved_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=user.user_id, role=user.role.value)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=TokenUser.model_validate(user),
    )
