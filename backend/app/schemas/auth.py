"""Authentication contracts (endpoints #1 signup / #2 login)."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class SignupRequest(BaseModel):
    """Registration payload — initialises the educator workspace."""

    full_name: str = Field(min_length=2, max_length=128)
    email: EmailStr
    institution_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.teacher


class SignupResponse(BaseModel):
    status: str = "success"
    user_id: UUID


class LoginRequest(BaseModel):
    """JSON login body (form-encoded OAuth2 is also accepted on the same route)."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    full_name: str
    email: EmailStr
    institution_name: str
    role: UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: TokenUser
