
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  MoreHorizontal, 
  Clock, 
  User as UserIcon, 
  Hash,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldAlert,
  Loader2,
  Reply,
  FileText,
  X,
  MessageSquareQuote,
  Activity,
  Star
} from 'lucide-react';
import { MOCK_TICKETS, MOCK_MESSAGES, MOCK_USERS } from '../../constants';
import { Message, Ticket } from '../../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/AuthContext';

interface CannedResponse {
  id: string;
  category: string;
  title: string;
  content: string;
}

interface Props {
  portal: 'user' | 'admin';
}

export default function TicketDetailView({ portal }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [ticketTags, setTicketTags] = useState<{id: string, name: string, color: string}[]>([]);
  const [availableTags, setAvailableTags] = useState<{id: string, name: string, color: string}[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ticketAttachments, setTicketAttachments] = useState<any[]>([]);
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socket = getSocket();
  const typingTimeoutRef = useRef<NodeJS.Timeout|null>(null);

  const playSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch Ticket
        const ticketRes = await fetch(`/api/tickets/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (ticketRes.ok) {
          const ticketData = await ticketRes.json();
          setTicket(ticketData);
        }

        // Fetch Messages
        const messagesRes = await fetch(`/api/tickets/${id}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          setMessages(messagesData);
        }

        // Fetch Tags
        const tagsRes = await fetch(`/api/tickets/${id}/tags`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (tagsRes.ok) setTicketTags(await tagsRes.json());

        const availTagsRes = await fetch('/api/tags', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (availTagsRes.ok) setAvailableTags(await availTagsRes.json());
        
        // Fetch Attachments
        const attachRes = await fetch(`/api/tickets/${id}/attachments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (attachRes.ok) setTicketAttachments(await attachRes.json());

      } catch (err) {
        console.error('Fetch ticket detail error:', err);
        toast.error('Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    if (id && token) {
      fetchData();
    }
  }, [id, token]);

  useEffect(() => {
    const fetchResponses = async () => {
      if (portal === 'admin' && token) {
        const res = await fetch('/api/admin/canned-responses', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setCannedResponses(await res.json());
      }
    };
    fetchResponses();
  }, [portal, token]);

  useEffect(() => {
    socket.emit('join-room', id);

    socket.on('message-received', (msg: Message) => {
      if (msg.ticketId === id) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          if (!document.hasFocus()) playSound();
          return [...prev, msg];
        });
      }
    });

    socket.on('user-typing', ({ userId, isTyping }) => {
      if (userId !== user?.id) {
        setIsOtherTyping(isTyping);
      }
    });

    return () => {
      socket.off('message-received');
      socket.off('user-typing');
    };
  }, [id, socket, user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    setUploading(true);

    let uploadedUrls: string[] = [];
    try {
      for (const file of attachments) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ticketId', id!);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          uploadedUrls.push(data.url);
          setTicketAttachments(prev => [...prev, data]);
        }
      }

      const msg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        ticketId: id!,
        senderId: user?.id || 'unknown',
        content: newMessage,
        replyToId: replyingTo?.id,
        createdAt: new Date().toISOString(),
        attachments: uploadedUrls,
      };

      socket.emit('new-message', msg);
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
      setReplyingTo(null);
      setAttachments([]);
      socket.emit('typing', { ticketId: id, userId: user?.id, isTyping: false });
    } catch (err) {
      console.error('Send message error:', err);
      toast.error('Failed to send message');
    } finally {
      setUploading(false);
    }
  };

  const onTyping = (text: string) => {
    setNewMessage(text);
    
    socket.emit('typing', { ticketId: id, userId: user?.id, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { ticketId: id, userId: user?.id, isTyping: false });
    }, 2000);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Synchronizing Secure Feed...</p>
        </div>
      </div>
    );
  }

  const handleAddTag = async (tagName: string) => {
    try {
      const res = await fetch(`/api/tickets/${id}/tags`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ tagName })
      });
      if (res.ok) {
        const newTag = await res.json();
        setTicketTags(prev => [...prev.filter(t => t.name !== tagName), newTag]);
        toast.success(`Tag "${tagName}" applied`);
        setShowTags(false);
      }
    } catch (err) {
      console.error('Add tag error:', err);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!rating) return;
    setSubmittingFeedback(true);
    try {
      const res = await fetch(`/api/tickets/${id}/feedback`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ rating, feedback })
      });
      if (res.ok) {
        toast.success('Thank you for your feedback!');
        setTicket(prev => prev ? { ...prev, rating, feedback } : null);
      } else {
        toast.error('Failed to submit feedback');
      }
    } catch (err) {
      console.error('Feedback submission error:', err);
      toast.error('Connection error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleResolveTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status: 'resolved' })
      });

      if (res.ok) {
        toast.success('Ticket marked as Resolved');
        setTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to resolve ticket');
      }
    } catch (err) {
      console.error('Resolve error:', err);
      toast.error('Connection error');
    }
  };

  const handleReopenTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${id}/reopen`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}` 
        }
      });

      if (res.ok) {
        toast.success('Ticket reopened');
        setTicket(prev => prev ? { ...prev, status: 'open' } : null);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to reopen ticket');
      }
    } catch (err) {
      console.error('Reopen error:', err);
      toast.error('Connection error');
    }
  };

  if (!ticket) return <div>Ticket not found</div>;

  const requestor = MOCK_USERS.find(u => u.id === ticket.userId) || { name: 'Customer', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${ticket.userId}`, email: 'customer@example.com' };

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(portal === 'user' ? '/user' : '/admin')} className="rounded-xl">
              <ArrowLeft size={18} />
            </Button>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-400 font-mono tracking-tighter">#{ticket.id}</span>
                 <h1 className="text-sm font-bold text-slate-900 truncate">{ticket.subject}</h1>
               </div>
               <p className="text-[10px] text-slate-500 flex items-center gap-1">
                 <Clock size={10} /> Opened {ticket.createdAt ? format(new Date(ticket.createdAt), 'PPp') : 'Recently'}
               </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" className="hidden sm:flex rounded-lg border-slate-200 gap-2 h-9" onClick={() => toast.info('Support docs requested')}>
                <ShieldAlert size={14} className="text-slate-400" /> Need Help?
             </Button>
             <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9"><MoreHorizontal size={18} /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <div className="flex gap-4">
               <Avatar className="w-10 h-10 border-2 border-white shadow-sm ring-1 ring-slate-200">
                 <AvatarImage src={requestor.avatar} />
                 <AvatarFallback>U</AvatarFallback>
               </Avatar>
               <div className="flex-1">
                 <div className="flex items-center gap-2 mb-1.5">
                   <span className="text-sm font-bold text-slate-900">{requestor.name}</span>
                   <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Original Post</span>
                 </div>
                 <div className="bg-white p-6 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                   {ticket.description}
                 </div>
               </div>
            </div>

            <div className="flex items-center gap-4 py-4">
               <div className="h-[1px] flex-1 bg-slate-200" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-4">Timeline History</span>
               <div className="h-[1px] flex-1 bg-slate-200" />
            </div>

            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMe = (msg.senderId === user?.id);
                const sender = MOCK_USERS.find(u => u.id === msg.senderId) || (isMe ? user : { name: portal === 'user' ? 'Support' : 'Customer', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}` });
                const replyTo = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
                const replySender = replyTo ? (MOCK_USERS.find(u => u.id === replyTo.senderId) || { name: 'User' }) : null;
                
                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-4 group ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="w-10 h-10 border-2 border-white shadow-sm ring-1 ring-slate-200 shrink-0 self-end mb-2">
                      <AvatarImage src={sender?.avatar} />
                      <AvatarFallback>{sender?.name ? sender.name[0] : '?'}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] space-y-2 ${isMe ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-bold text-slate-900">{sender?.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : 'Now'}</span>
                      </div>
                      
                      <div className="relative">
                        {replyTo && (
                          <div className={`text-xs p-3 mb-2 bg-slate-100 border-l-4 border-slate-300 text-slate-500 italic rounded-md ${isMe ? 'text-right' : 'text-left'}`}>
                             <div className="font-bold not-italic text-[10px] uppercase mb-1">{replySender?.name}</div>
                             <div className="line-clamp-1">{replyTo.content}</div>
                          </div>
                        )}
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed relative ${
                          isMe 
                            ? 'bg-slate-900 text-white rounded-tr-none' 
                            : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-none'
                        }`}>
                          {msg.content}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                               {msg.attachments.map((file, idx) => {
                                 const isImage = typeof file === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
                                 return (
                                   <div key={idx} className={`flex flex-col gap-2 p-2 rounded-lg text-xs ${isMe ? 'bg-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                                      {isImage && (
                                        <img src={file} alt="preview" className="max-w-[200px] max-h-[150px] rounded object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(file, '_blank')} />
                                      )}
                                      <div className="flex items-center gap-2">
                                        <FileText size={14} />
                                        {typeof file === 'string' && file.startsWith('/') ? (
                                          <a href={file} target="_blank" rel="noopener noreferrer" className="hover:underline flex-1 truncate max-w-[150px]">
                                             {file.split('-').pop() || file}
                                          </a>
                                        ) : (
                                          <span className="flex-1 truncate max-w-[150px]">{file}</span>
                                        )}
                                      </div>
                                   </div>
                                 );
                               })}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => setReplyingTo(msg)}
                          className={`absolute top-0 p-2 text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-100 rounded-full shadow-sm -translate-y-1/2 ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}
                        >
                          <Reply size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {isOtherTyping && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest pl-14"
              >
                 <Activity size={12} className="animate-pulse text-primary" /> 
                 {portal === 'user' ? 'Support Agent ' : 'Customer '} is typing...
              </motion.div>
            )}

            {ticket?.status === 'resolved' && portal === 'user' && !ticket.rating && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-lg bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-xl shadow-slate-200/50 my-12"
              >
                <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                   <Star size={32} fill="currentColor" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Rate your experience</h3>
                <p className="text-slate-500 text-sm mb-8 font-medium">How helpful was our response today?</p>
                
                <div className="flex justify-center gap-6 mb-8 py-4">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star}
                          onClick={() => setRating(star)}
                          className={`w-12 h-12 rounded-2xl transition-all duration-300 transform hover:scale-110 ${rating >= star ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                        >
                          <Star size={24} fill={rating >= star ? 'currentColor' : 'none'} className={rating >= star ? 'animate-in zoom-in-50 duration-300' : ''} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <textarea 
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Any additional comments?"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all mb-4 min-h-[100px] resize-none font-medium"
                />
                
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleSubmitFeedback}
                    disabled={!rating || submittingFeedback}
                    className="w-full h-14 rounded-[1.25rem] bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm tracking-tight transition-all active:scale-95 disabled:opacity-50"
                  >
                     {submittingFeedback ? 'Submitting...' : 'Submit Feedback & Close Ticket'}
                  </Button>
                  
                  <Button 
                    variant="ghost"
                    onClick={handleReopenTicket}
                    className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest"
                  >
                    Not satisfied? Reopen Ticket
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-200 z-10 shrink-0">
          <div className="max-w-4xl mx-auto space-y-4">
             {replyingTo && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between"
               >
                 <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-8 bg-primary rounded-full" />
                    <div className="min-w-0">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Replying to {MOCK_USERS.find(u => u.id === replyingTo.senderId)?.name}</p>
                       <p className="text-xs text-slate-600 truncate">{replyingTo.content}</p>
                    </div>
                 </div>
                 <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={() => setReplyingTo(null)}>
                    <X size={14} />
                 </Button>
               </motion.div>
             )}

             {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                   {attachments.map((file, idx) => (
                     <div key={idx} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border border-blue-100">
                        <FileText size={12} />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button onClick={() => removeAttachment(idx)}><X size={12} /></button>
                     </div>
                   ))}
                </div>
             )}

             <div className="relative bg-white border-2 border-slate-100 rounded-2xl p-2 focus-within:border-primary/40 transition-all shadow-sm">
                {showCanned && (
                  <div className="absolute bottom-full left-0 mb-4 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Canned Responses</span>
                       <button onClick={() => setShowCanned(false)}><X size={12} /></button>
                    </div>
                    <ScrollArea className="h-60">
                      <div className="p-2 space-y-1">
                        {cannedResponses.map(resp => (
                          <button 
                            key={resp.id}
                            onClick={() => {
                              setNewMessage(resp.content);
                              setShowCanned(false);
                            }}
                            className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors group"
                          >
                            <p className="text-xs font-bold text-slate-900 group-hover:text-primary transition-colors">{resp.title}</p>
                            <p className="text-[10px] text-slate-500 line-clamp-1">{resp.content}</p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                <Textarea 
                  placeholder={ticket.rating ? "Ticket is finalized. Feedback submitted." : `Reply as ${portal === 'user' ? 'Customer' : 'Support Specialist'}...`}
                  readOnly={!!ticket.rating}
                  className="bg-transparent border-none focus-visible:ring-0 min-h-[120px] resize-none pb-12"
                  value={newMessage}
                  onChange={(e) => onTyping(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between border-t border-slate-100/50 pt-3">
                   <div className="flex items-center gap-1">
                      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={onFileChange} />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled={!!ticket.rating}
                        className="w-9 h-9 text-slate-400 hover:text-primary rounded-xl"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip size={20} />
                      </Button>
                      {portal === 'admin' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          disabled={!!ticket.rating}
                          className={`w-9 h-9 rounded-xl transition-colors ${showCanned ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-primary'}`}
                          onClick={() => setShowCanned(!showCanned)}
                        >
                          <MessageSquareQuote size={20} />
                        </Button>
                      )}
                      <div className="relative">
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           disabled={!!ticket.rating}
                           className={`w-9 h-9 rounded-xl transition-colors ${showTags ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-primary'}`}
                           onClick={() => setShowTags(!showTags)}
                         >
                           <Tag size={20} />
                         </Button>
                         
                         {showTags && (
                           <div className="absolute bottom-full left-0 mb-4 w-40 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                              <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Add Tag</div>
                              <div className="p-1">
                                 {['Bug', 'Billing', 'Security', 'Feature', 'Support'].map(tag => (
                                   <button 
                                     key={tag}
                                     onClick={() => handleAddTag(tag)}
                                     className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 rounded-lg flex items-center justify-between"
                                   >
                                      {tag}
                                      {ticketTags.some(t => t.name === tag) && <CheckCircle2 size={12} className="text-primary" />}
                                   </button>
                                 ))}
                              </div>
                           </div>
                         )}
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <Button 
                        size="sm" 
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() && attachments.length === 0}
                        className="bg-primary hover:bg-primary/90 text-white px-6 rounded-xl gap-2 font-bold shadow-lg shadow-primary/20"
                      >
                         Send <Send size={16} />
                      </Button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-80 flex-col border-l border-slate-200 h-full bg-white shrink-0">
        <ScrollArea className="flex-1">
          <div className="p-8">
            <div className="mb-10 text-center">
               <Avatar className="w-20 h-20 mx-auto mb-4 border-4 border-slate-50 shadow-md">
                 <AvatarImage src={requestor?.avatar} />
                 <AvatarFallback>U</AvatarFallback>
               </Avatar>
               <h3 className="font-bold text-slate-900">{requestor?.name}</h3>
               <p className="text-xs text-slate-500">{requestor?.email}</p>
               <Badge className="mt-3 bg-slate-100 text-slate-600 border-slate-200/50 hover:bg-slate-100 uppercase text-[9px] font-bold tracking-widest px-3">Standard Account</Badge>
            </div>

            <div className="space-y-8">
               <section>
                 <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Request Detail</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-500 flex items-center gap-2"><Hash size={12} /> Ticket ID</span>
                       <span className="text-xs font-mono font-bold text-slate-700">{ticket.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-500 flex items-center gap-2"><CheckCircle2 size={12} /> Status</span>
                       <Badge variant="outline" className={`text-[10px] font-bold uppercase transition-colors ${
                         ticket.status === 'open' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                         ticket.status === 'resolved' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-500'
                       }`}>
                         {ticket.status}
                       </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-500 flex items-center gap-2"><AlertCircle size={12} /> Priority</span>
                       <span className={`text-xs font-bold uppercase ${
                         ticket.priority === 'urgent' ? 'text-red-500' : 
                         ticket.priority === 'high' ? 'text-orange-500' : 'text-slate-500'
                       }`}>{ticket.priority}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-500 flex items-center gap-2"><Tag size={12} /> Category</span>
                       <span className="text-xs font-bold text-slate-700">{ticket.category}</span>
                    </div>
                    {ticketTags.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {ticketTags.map(tag => (
                          <Badge key={tag.id} className="bg-slate-100 text-slate-600 border-none text-[10px] uppercase font-bold py-0.5 px-2">
                             {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                 </div>
               </section>

               {portal === 'admin' && (
                 <section className="pt-6 border-t border-slate-100">
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Internal Controls</h4>
                    <div className="grid grid-cols-2 gap-2">
                       <Button variant="outline" size="sm" className="w-full text-[10px] font-bold tracking-tight rounded-lg h-9 border-slate-200" onClick={() => toast.info('Re-assignment queue opened')}>
                          Re-Assign
                       </Button>
                       <Button variant="outline" size="sm" className="w-full text-[10px] font-bold tracking-tight rounded-lg h-9 border-slate-200" onClick={() => toast.info('Transfer protocols initiated')}>
                          Transfer
                       </Button>
                       <Button size="sm" className="w-full col-span-2 text-[10px] font-bold tracking-tight rounded-lg h-10 bg-green-600 hover:bg-green-700 shadow-sm" onClick={handleResolveTicket}>
                          Resolve Case
                       </Button>
                    </div>
                 </section>
               )}

               <section className="pt-6 border-t border-slate-100">
                 <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Related Assets</h4>
                 <div className="space-y-3">
                   {ticketAttachments.length > 0 ? ticketAttachments.map(file => (
                     <a 
                       key={file.id} 
                       href={file.fileUrl} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 group cursor-pointer hover:bg-slate-100/50 transition-colors"
                     >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-200 group-hover:border-primary transition-colors">
                           <FileText size={16} className="text-slate-400 group-hover:text-primary" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[10px] font-bold text-slate-900 group-hover:text-primary truncate">{file.fileName}</p>
                           <p className="text-[9px] text-slate-400">{(file.fileSize / 1024).toFixed(1)} KB • {file.fileType?.split('/')?.[1]?.toUpperCase() || 'FILE'}</p>
                        </div>
                     </a>
                   )) : (
                     <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        <Paperclip size={20} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">No assets attached</p>
                     </div>
                   )}
                 </div>
               </section>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
