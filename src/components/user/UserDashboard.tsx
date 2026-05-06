
import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter,
  LifeBuoy,
  ArrowLeft,
  ChevronRight,
  Send,
  X,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '../../lib/AuthContext';
import { Ticket } from '../../types';

export default function UserDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'Technical', message: '' });

  useEffect(() => {
    if (location.state?.openNewTicket) {
      setIsNewTicketOpen(true);
      // Clean up state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    fetchTickets();
  }, [token]);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
      toast.error('Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'closed': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default: return null;
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          subject: newTicket.subject,
          description: newTicket.message,
          category: newTicket.category,
          priority: 'medium'
        })
      });

      if (res.ok) {
        const created = await res.json();
        setTickets([created, ...tickets]);
        toast.success('Support ticket created successfully!');
        setIsNewTicketOpen(false);
        setNewTicket({ subject: '', category: 'Technical', message: '' });
      } else {
        toast.error('Failed to create ticket');
      }
    } catch (err) {
      console.error('Create ticket error:', err);
      toast.error('Something went wrong');
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = tickets.filter(t => t.status === 'open' || t.status === 'pending').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const pendingCount = tickets.filter(t => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-slate-100 px-6 h-16 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
             <ArrowLeft className="w-4 h-4 text-slate-400" />
             <div className="bg-primary/10 p-1.5 rounded-lg">
                <LifeBuoy className="w-5 h-5 text-primary" />
             </div>
             <span className="font-bold tracking-tight text-slate-900">Zenith<span className="font-light text-slate-500">Desk</span></span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200" />
          <span className="text-sm font-medium text-slate-600">Customer Support Area</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900">Documentation</Button>
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 cursor-pointer hover:border-slate-400 transition-colors" />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">My Requests</h1>
            <p className="text-slate-500 text-sm">Track your support tickets and get updates in real-time.</p>
          </div>
          
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger 
              render={
                <Button className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 gap-2 items-center shadow-lg shadow-slate-900/10">
                  <Plus size={18} /> New Support Ticket
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-[32px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Open New Ticket</DialogTitle>
                <DialogDescription className="text-slate-500">
                  Fill in the details below to reach out to our support specialists.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTicket} className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject</Label>
                  <Input 
                    id="subject" 
                    placeholder="e.g., Issue with subscription plan" 
                    required 
                    className="h-12 rounded-xl bg-slate-50 border-0 focus-visible:ring-2 focus-visible:ring-primary/20"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-slate-400">Category</Label>
                  <select 
                    id="category"
                    className="w-full h-12 rounded-xl bg-slate-50 border-0 px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({...newTicket, category: e.target.value})}
                  >
                    <option>Technical</option>
                    <option>Billing</option>
                    <option>Account</option>
                    <option>Feature Request</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-slate-400">Message</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Provide details about your request..." 
                    required 
                    className="min-h-[120px] rounded-xl bg-slate-50 border-0 focus-visible:ring-2 focus-visible:ring-primary/20 resize-none"
                    value={newTicket.message}
                    onChange={(e) => setNewTicket({...newTicket, message: e.target.value})}
                  />
                </div>
                <DialogFooter className="sm:justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsNewTicketOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 gap-2">
                    Submit Ticket <Send size={16} />
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Active Tickets', value: activeCount, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Pending Response', value: pendingCount, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Resolved', value: resolvedCount, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
            >
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                <stat.icon size={20} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Ticket List Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by ID or subject..." 
              className="pl-10 h-11 bg-white border-slate-200 rounded-xl focus:ring-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 rounded-xl gap-2 border-slate-200">
            <Filter size={16} /> Filters
          </Button>
        </div>

        {/* Ticket List Table-ish */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-h-[200px] bg-white relative">
           {isLoading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
               <Loader2 className="w-8 h-8 text-primary animate-spin" />
             </div>
           ) : null}
           <div className="bg-slate-50 px-6 py-3 grid grid-cols-12 gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
              <div className="col-span-2">Ticket ID</div>
              <div className="col-span-5">Subject</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Last Update</div>
              <div className="col-span-1"></div>
           </div>
           <div className="divide-y divide-slate-100">
              {filteredTickets.map((ticket, i) => (
                <motion.div 
                  key={ticket.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 + (i * 0.05) }}
                  onClick={() => navigate(`/user/ticket/${ticket.id}`)}
                  className="px-6 py-5 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="col-span-2 font-mono text-sm text-slate-500">#{ticket.id}</div>
                  <div className="col-span-5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{ticket.subject}</span>
                      {getPriorityIcon(ticket.priority)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{ticket.category}</p>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline" className={`${getStatusColor(ticket.status)} capitalize border px-2 py-0.5 text-[10px] font-bold`}>
                      {ticket.status}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-xs text-slate-500">
                    {ticket.createdAt ? format(new Date(ticket.createdAt), 'MMM d, h:mm a') : 'N/A'}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </div>
                </motion.div>
              ))}
           </div>
        </div>
        
        {!isLoading && filteredTickets.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-2xl mt-4 border border-dashed border-slate-200">
            <LifeBuoy className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">No tickets found</h3>
            <p className="text-slate-500">Try adjusting your search or creative a new ticket.</p>
          </div>
        )}
      </main>
    </div>
  );
}
