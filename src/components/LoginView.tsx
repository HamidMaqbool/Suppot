import * as React from 'react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, User, LogIn, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';

export default function LoginView() {
  const [searchParams] = useSearchParams();
  const roleFromUrl = searchParams.get('role') as 'admin' | 'user' || 'user';
  
  const [email, setEmail] = useState(roleFromUrl === 'admin' ? 'admin@zenith.com' : 'user@example.com');
  const [password, setPassword] = useState(roleFromUrl === 'admin' ? 'admin123' : 'user123');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: roleFromUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        login(data.token, data.user);
        toast.success('Welcome back!');
        navigate(roleFromUrl === 'admin' ? '/admin' : '/user');
      } else {
        toast.error('Invalid credentials');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl p-10">
          <div className="flex justify-center mb-8">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${roleFromUrl === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
              {roleFromUrl === 'admin' ? <ShieldCheck size={32} /> : <User size={32} />}
            </div>
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {roleFromUrl === 'admin' ? 'Agent Login' : 'Customer Login'}
            </h1>
            <p className="text-slate-500 mt-2">Access your ZenithDesk portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <Input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <Input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all"
                required
              />
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className={`w-full h-12 rounded-xl mt-6 text-white font-bold gap-2 ${roleFromUrl === 'admin' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <>Sign In <LogIn size={18} /></>}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
             <button 
               onClick={() => navigate(`/login?role=${roleFromUrl === 'admin' ? 'user' : 'admin'}`)}
               className="text-xs font-bold text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
             >
                Switch to {roleFromUrl === 'admin' ? 'Customer' : 'Agent'} Login <ArrowRight size={14} />
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
