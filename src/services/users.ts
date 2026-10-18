import pb from '@/lib/pocketbase/client'
import type { CreateUserInput, UpdateUserInput, UserProfile } from '@/types/finance'

export async function listProfiles(): Promise<UserProfile[]> {
  return pb.collection('profiles').getFullList<UserProfile>({
    sort: '-created',
  })
}

export async function createUser(data: CreateUserInput): Promise<UserProfile> {
  return pb.send<UserProfile>('/backend/v1/users/create', {
    method: 'POST',
    body: {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
    },
  })
}

export async function updateUser(data: UpdateUserInput): Promise<UserProfile> {
  return pb.send<UserProfile>('/backend/v1/users/update', {
    method: 'POST',
    body: {
      profileId: data.profileId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      active: data.active,
      password: data.password ? data.password : undefined,
    },
  })
}

export async function toggleUserActive(
  profileId: string,
  currentActive: boolean,
): Promise<UserProfile> {
  const profile = await pb.collection('profiles').getOne<UserProfile>(profileId)
  return updateUser({
    profileId,
    name: profile.name,
    email: profile.email,
    active: !currentActive,
  })
}
