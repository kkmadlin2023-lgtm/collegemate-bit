import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  HelpCircle,
  Bug,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ImageUploader } from '../../components/common/ImageUploader';
import { formatDistanceToNow, format } from 'date-fns';

export const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'SUGGESTION' | 'BUG_REPORT' | 'CAMPUS_QUERY' | 'COMPLAINT' | 'GENERAL'>('SUGGESTION');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('feedback')
        .select('*, feedback_replies(*, profiles:admin_id(full_name, avatar_url))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!err && data) {
        setFeedbackList(data);
      }
    } catch (e) {
      console.error('Error fetching feedback:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();

    if (!user) return;
    // Live Realtime updates for replies
    const channel = supabase
      .channel(`public:user-feedback:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback', filter: `user_id=eq.${user.id}` },
        () => fetchFeedback()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback_replies' },
        () => fetchFeedback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both subject and description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error: insertErr } = await supabase.from('feedback').insert({
        user_id: user.id,
        subject: subject.trim(),
        message: message.trim(),
        category,
        image_urls: imageUrls,
        status: 'PENDING',
      } as any);

      if (insertErr) throw insertErr;

      setIsModalOpen(false);
      setSubject('');
      setMessage('');
      setImageUrls([]);
      fetchFeedback();
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Feedback & Student Support Desk
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Share suggestions, report app issues, or ask campus questions directly to administrators.
          </p>
        </div>

        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          Submit Feedback / Ticket
        </Button>
      </div>

      {/* Main Feedback List */}
      <Card className="p-0 overflow-hidden border">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            My Submissions & Administrator Responses
          </h3>
          <span className="text-xs text-slate-400">{feedbackList.length} tickets</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading your feedback history...
          </div>
        ) : feedbackList.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Feedback Submitted Yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
              Have an idea to improve CampusMate or encountered an issue? Let our admin team know!
            </p>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              Create Your First Ticket
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {feedbackList.map((item) => (
              <div key={item.id} className="p-5 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(item.category)}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.subject}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'RESOLVED' ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" /> Answered & Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3 h-3 mr-0.5" /> Pending Review
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
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
                        alt="Attached photo"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                      />
                    ))}
                  </div>
                )}

                {/* Admin Replies Section */}
                {item.feedback_replies && item.feedback_replies.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Administrator Replies
                    </span>
                    {item.feedback_replies.map((reply: any) => (
                      <div
                        key={reply.id}
                        className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-900 dark:text-indigo-200">
                            🛡️ {reply.profiles?.full_name || 'Campus Administrator'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
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

      {/* Submission Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit Feedback or Help Request"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {error && (
            <p className="text-xs text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl">
              {error}
            </p>
          )}

          <Select
            label="Category *"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            options={[
              { value: 'SUGGESTION', label: '💡 Feature Suggestion' },
              { value: 'BUG_REPORT', label: '🐛 Bug / Issue Report' },
              { value: 'CAMPUS_QUERY', label: '❓ Campus Life Query' },
              { value: 'COMPLAINT', label: '⚠️ Concern / Feedback' },
              { value: 'GENERAL', label: '💬 General Note' },
            ]}
          />

          <Input
            label="Subject *"
            placeholder="e.g. Lost item claim question / Schedule alert suggestion"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Detailed Description *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe your feedback, suggestion, or question in detail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Photo from Device */}
          <ImageUploader
            images={imageUrls}
            onChange={setImageUrls}
            maxImages={3}
            folder="feedback"
            label="Attach Screenshot or Photo (Optional)"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={submitting}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Ticket
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
 
