import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  HelpCircle,
  Bug,
  Lightbulb,
  AlertTriangle,
  Search,
  User,
  School,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { format } from 'date-fns';

export const AdminFeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('ALL');

  // Reply Modal
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const fetchAllFeedback = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('feedback')
        .select('*, profiles:user_id(id, full_name, email, college_name, department, student_id, avatar_url), feedback_replies(*, profiles:admin_id(full_name))')
        .order('created_at', { ascending: false });

      if (!err && data) {
        setFeedbackList(data);
      }
    } catch (e) {
      console.error('Error fetching admin feedback:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllFeedback();

    const channel = supabase
      .channel('public:admin-feedback-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback' },
        () => fetchAllFeedback()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback_replies' },
        () => fetchAllFeedback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFeedback || !replyMessage.trim()) return;

    setSendingReply(true);
    setReplyError(null);

    try {
      // 1. Try RPC function
      const { error: rpcErr } = await supabase.rpc('send_feedback_reply', {
        p_feedback_id: selectedFeedback.id,
        p_message: replyMessage.trim(),
      });

      if (rpcErr) {
        // Fallback direct insert
        await supabase.from('feedback_replies').insert({
          feedback_id: selectedFeedback.id,
          admin_id: user.id,
          message: replyMessage.trim(),
        });

        await supabase
          .from('feedback')
          .update({ status: 'RESOLVED', updated_at: new Date().toISOString() })
          .eq('id', selectedFeedback.id);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await supabase.from('notifications').insert({
          user_id: selectedFeedback.user_id,
          title: `💬 Admin Response: ${selectedFeedback.subject}`,
          body: replyMessage.trim(),
          type: 'FEEDBACK_REPLY',
          data: { feedback_id: selectedFeedback.id },
          expires_at: expiresAt.toISOString(),
        } as any);
      }

      setReplyMessage('');
      setSelectedFeedback(null);
      fetchAllFeedback();
    } catch (err: any) {
      console.error('Error sending feedback reply:', err);
      setReplyError(err.message || 'Failed to submit reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const filtered = feedbackList.filter((item) => {
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.subject?.toLowerCase().includes(q) ||
        item.message?.toLowerCase().includes(q) ||
        item.profiles?.full_name?.toLowerCase().includes(q) ||
        item.profiles?.email?.toLowerCase().includes(q) ||
        item.profiles?.college_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'BUG_REPORT':
        return <Badge variant="danger" size="sm"><Bug className="w-3 h-3 mr-1" /> Bug Report</Badge>;
      case 'SUGGESTION':
        return <Badge variant="indigo" size="sm"><Lightbulb className="w-3 h-3 mr-1" /> Feature Suggestion</Badge>;
      case 'CAMPUS_QUERY':
        return <Badge variant="purple" size="sm"><HelpCircle className="w-3 h-3 mr-1" /> Campus Query</Badge>;
      case 'COMPLAINT':
        return <Badge variant="warning" size="sm"><AlertTriangle className="w-3 h-3 mr-1" /> Concern</Badge>;
      default:
        return <Badge variant="neutral" size="sm"><MessageSquare className="w-3 h-3 mr-1" /> General</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Student Feedback & Support Tickets
            </h2>
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-pulse">
              ● Live Realtime
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review inquiries, suggestions, and bug reports from campus students and dispatch direct answers.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, college, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'ALL', label: `All Tickets (${feedbackList.length})` },
          { id: 'PENDING', label: `Pending (${feedbackList.filter((f) => f.status === 'PENDING').length})` },
          { id: 'RESOLVED', label: `Resolved (${feedbackList.filter((f) => f.status === 'RESOLVED').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterStatus === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback List Table / Cards */}
      <Card className="p-0 overflow-hidden border">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading student tickets...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Tickets Found</h4>
            <p className="text-xs text-slate-400 mt-1">No feedback matching your active filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((item) => (
              <div key={item.id} className="p-5 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(item.category)}
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.subject}
                      </h4>
                    </div>

                    {/* Student Info Pill */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        {item.profiles?.full_name || 'Student'} ({item.profiles?.email})
                      </span>
                      {item.profiles?.college_name && (
                        <span className="flex items-center gap-1">
                          <School className="w-3.5 h-3.5 text-purple-500" />
                          {item.profiles?.college_name}
                        </span>
                      )}
                      {item.profiles?.department && (
                        <span>• {item.profiles?.department}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status === 'RESOLVED' ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3 h-3 mr-0.5" /> Awaiting Answer
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant={item.status === 'RESOLVED' ? 'secondary' : 'primary'}
                      onClick={() => setSelectedFeedback(item)}
                    >
                      {item.status === 'RESOLVED' ? 'Add Another Reply' : 'Reply & Resolve'}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {item.message}
                </p>

                {/* Attached Photos */}
                {item.image_urls && item.image_urls.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    {item.image_urls.map((img: string, i: number) => (
                      <img
                        key={i}
                        src={img}
                        alt="Screenshot"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                      />
                    ))}
                  </div>
                )}

                {/* Existing Replies */}
                {item.feedback_replies && item.feedback_replies.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    {item.feedback_replies.map((reply: any) => (
                      <div
                        key={reply.id}
                        className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-900 dark:text-indigo-200">
                            🛡️ {reply.profiles?.full_name || 'Admin'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">
                          {reply.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reply Modal */}
      <Modal
        isOpen={Boolean(selectedFeedback)}
        onClose={() => setSelectedFeedback(null)}
        title="Reply to Student Feedback"
      >
        {selectedFeedback && (
          <form onSubmit={handleSendReply} className="space-y-4 text-left">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="text-slate-400 font-medium">Original Student Question:</span>
              <p className="font-bold text-slate-900 dark:text-white">{selectedFeedback.subject}</p>
              <p className="text-slate-600 dark:text-slate-300">{selectedFeedback.message}</p>
            </div>

            {replyError && (
              <p className="text-xs text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl">
                {replyError}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Admin Response & Solution *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Write your direct answer for the student..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFeedback(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                isLoading={sendingReply}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Send Response & Notify Student
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
 
