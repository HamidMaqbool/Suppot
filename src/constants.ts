
import { Ticket, User, Message } from './types';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    role: 'user',
  },
  {
    id: 'a1',
    name: 'Sarah Smith',
    email: 'sarah.support@zenith.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    role: 'admin',
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'T-1001',
    userId: 'u1',
    subject: 'Cannot access my billing dashboard',
    description: 'I keep getting a 403 error whenever I try to open the billing settings page.',
    status: 'open',
    priority: 'high',
    category: 'Billing',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    lastMessageAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'T-1002',
    userId: 'u1',
    subject: 'Request for custom API integration',
    description: 'We are looking to integrate Zenith with our internal CRM via webhooks.',
    status: 'pending',
    priority: 'medium',
    category: 'Feature Request',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastMessageAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'T-1003',
    userId: 'u1',
    subject: 'Profile picture not updating',
    description: 'Every time I upload a new photo, it reverts back after refreshing.',
    status: 'resolved',
    priority: 'low',
    category: 'Technical',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastMessageAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    ticketId: 'T-1001',
    senderId: 'u1',
    content: "I've tried clearing my cache but the billing page is still inaccessible.",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'm2',
    ticketId: 'T-1001',
    senderId: 'a1',
    content: "Hi Alex, I'm looking into this right now. It seems like a permissions sync issue on our end.",
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];
