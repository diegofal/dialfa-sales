import { User, UsersResponse, CreateUserDTO } from '@/types/user';

export async function getUsers(page = 1, limit = 50): Promise<UsersResponse> {
  const response = await fetch(`/api/users?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

export async function createUser(data: CreateUserDTO): Promise<User> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create user');
  }
  return response.json();
}

export async function updateUser(id: number, data: Partial<CreateUserDTO> & { isActive?: boolean }): Promise<User> {
  const response = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update user');
  }
  return response.json();
}

export async function deactivateUser(id: number): Promise<void> {
  const response = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to deactivate user');
}





