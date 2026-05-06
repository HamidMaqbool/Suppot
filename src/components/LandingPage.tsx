
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck, User, ArrowRight, LifeBuoy } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <LifeBuoy className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 italic">Zenith<span className="font-light not-italic text-slate-500">Desk</span></h1>
        </div>
        <p className="text-slate-500 text-lg max-w-md mx-auto">
          Modern support infrastructure designed for high-performance teams and their customers.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileHover={{ y: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all relative overflow-hidden group border-b-8 border-b-blue-500/20"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <User size={160} />
          </div>
          <div className="relative z-10">
            <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-blue-100">
              <User className="text-blue-600 w-7 h-7" />
            </div>
            <h2 className="text-3xl font-bold mb-3 tracking-tight text-slate-900">Customer Portal</h2>
            <p className="text-slate-500 mb-10 leading-relaxed">
              Open tickets, track real-time responses, and manage your support history with an intuitive secure interface.
            </p>
            <Button 
              onClick={() => navigate('/login?role=user')}
              className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white gap-3 font-bold text-lg shadow-lg shadow-slate-900/10 group/btn"
            >
              Enter Customer Area <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileHover={{ y: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 transition-all relative overflow-hidden group border-b-8 border-b-purple-500/20"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <ShieldCheck size={160} />
          </div>
          <div className="relative z-10">
            <div className="bg-purple-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-purple-100">
              <ShieldCheck className="text-purple-600 w-7 h-7" />
            </div>
            <h2 className="text-3xl font-bold mb-3 tracking-tight text-slate-900">Admin Command</h2>
            <p className="text-slate-500 mb-10 leading-relaxed">
              Manage global incident streams, analyze performance metrics, and orchestrate support operations.
            </p>
            <Button 
              onClick={() => navigate('/login?role=admin')}
              variant="outline"
              className="w-full h-14 rounded-2xl border-slate-200 hover:bg-slate-50 gap-3 font-bold text-lg group/btn"
            >
              Access Admin Center <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-16 text-slate-400 text-sm flex gap-6"
      >
        <span>© 2026 Zenith Systems</span>
        <button className="hover:text-slate-600">Privacy Policy</button>
        <button className="hover:text-slate-600">Terms of Service</button>
      </motion.div>
    </div>
  );
}
