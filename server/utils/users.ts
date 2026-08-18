import type { User } from '@prisma/client'

export function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    admin: user.role === 'admin',
    active: user.active,
    theme: user.theme,
    activeNodeId: user.activeNodeId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}
