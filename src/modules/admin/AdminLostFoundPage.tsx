import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { ItemStatus, ClaimStatus } from '../../types/database.types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';

export const AdminLostFoundPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'CLAIMS' | 'LOST' | 'FOUND'>('CLAIMS');
  const [claims, setClaims] = useState<any[]>([]);
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [foundItems, setFoundItems] = useState<any[]>([]);

  // Review Claim Modal
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchModerationData = async () => {
    try {
      // 1. Fetch claims
      const { data: claimsData } = await supabase
        .from('claims')
        .select('*, found_items(*), profiles!claimant_id(full_name, email)')
        .order('created_at', { ascending: false });

      if (claimsData) setClaims(claimsData);

      // 2. Fetch lost items
      const { data: lostData } = await supabase
        .from('lost_items')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (lostData) setLostItems(lostData);

      // 3. Fetch found items
      const { data: foundData } = await supabase
        .from('found_items')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (foundData) setFoundItems(foundData);
    } catch (err) {
      console.error('Error fetching moderation items:', err);
    }
  };

  useEffect(() => {
    fetchModerationData();
  }, []);

  const handleDeleteItem = async (type: 'LOST' | 'FOUND', id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }

    try {
      const table = type === 'LOST' ? 'lost_items' : 'found_items';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;

      await supabase.from('admin_logs').insert({
        admin_id: user!.id,
        action: `${type}_ITEM_DELETED`,
        target_table: table,
        target_id: id,
        details: { title },
      } as any);

      fetchModerationData();
    } catch (err: any) {
      console.error(`Error deleting ${type} item:`, err);
      alert(err.message || 'Failed to delete item.');
    }
  };

  const handleUpdateItemStatus = async (
    type: 'LOST' | 'FOUND',
    id: string,
    newStatus: ItemStatus
  ) => {
    try {
      const table = type === 'LOST' ? 'lost_items' : 'found_items';
      await supabase
        .from(table)
        .update({
          status: newStatus,
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        } as any)
        .eq('id', id);

      await supabase.from('admin_logs').insert({
        admin_id: user!.id,
        action: `${type}_ITEM_STATUS_${newStatus}`,
        target_table: table,
        target_id: id,
        details: { status: newStatus },
      } as any);

      fetchModerationData();
    } catch (err) {
      console.error('Error updating item status:', err);
    }
  };

  const handleReviewClaim = async (newStatus: ClaimStatus) => {
    if (!selectedClaim) return;
    setSubmittingReview(true);
    try {
      await supabase
        .from('claims')
        .update({
          status: newStatus,
          review_notes: reviewNotes.trim() || null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedClaim.id);

      if (newStatus === 'APPROVED' && selectedClaim.found_item_id) {
        await supabase
          .from('found_items')
          .update({ status: 'CLAIMED' } as any)
          .eq('id', selectedClaim.found_item_id);
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase.from('notifications').insert({
        user_id: selectedClaim.claimant_id,
        title: `Claim Update: ${newStatus}`,
        body: `Your ownership claim for "${selectedClaim.found_items?.title || 'item'}" was marked as ${newStatus}. ${reviewNotes ? `Note: ${reviewNotes}` : ''}`,
        type: 'CLAIM',
        expires_at: expiresAt.toISOString(),
      } as any);

      await supabase.from('admin_logs').insert({
        admin_id: user!.id,
        action: `CLAIM_${newStatus}`,
        target_table: 'claims',
        target_id: selectedClaim.id,
        details: { claimStatus: newStatus, notes: reviewNotes },
      } as any);

      fetchModerationData();
      setSelectedClaim(null);
      setReviewNotes('');
    } catch (err) {
      console.error('Error reviewing claim:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Lost & Found Moderation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Approve public listings, review ownership verification claims, and manage return handovers.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('CLAIMS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'CLAIMS'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Ownership Claims ({claims.filter((c) => c.status === 'PENDING').length} Pending)
          </button>
          <button
            onClick={() => setActiveTab('LOST')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'LOST'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Lost Reports ({lostItems.filter((i) => i.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveTab('FOUND')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'FOUND'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Found Reports ({foundItems.filter((i) => i.status === 'PENDING').length})
          </button>
        </div>
      </div>

      {/* CLAIMS REVIEW TAB */}
      {activeTab === 'CLAIMS' && (
        <Card className="p-0 overflow-hidden border">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {claims.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">No ownership claims submitted.</p>
            ) : (
              claims.map((claim) => (
                <div key={claim.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          claim.status === 'APPROVED'
                            ? 'success'
                            : claim.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {claim.status}
                      </Badge>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Claim on: {claim.found_items?.title || 'Found Item'}
                      </h4>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white">Proof: </span>
                      {claim.proof_description}
                    </p>

                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Claimant: {claim.profiles?.full_name} ({claim.profiles?.email})</span>
                      <span>• Submitted {format(new Date(claim.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedClaim(claim);
                        setReviewNotes(claim.review_notes || '');
                      }}
                    >
                      Review & Decide
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* LOST ITEMS MODERATION TAB */}
      {activeTab === 'LOST' && (
        <Card className="p-0 overflow-hidden border">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lostItems.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">No lost item reports.</p>
            ) : (
              lostItems.map((item) => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'}>
                        {item.status}
                      </Badge>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                    <p className="text-[11px] text-slate-400">
                      Reported by: {item.profiles?.full_name} ({item.profiles?.email}) • Last seen: {item.last_seen_location}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status !== 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleUpdateItemStatus('LOST', item.id, 'APPROVED')}
                      >
                        Approve Listing
                      </Button>
                    )}
                    {item.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleUpdateItemStatus('LOST', item.id, 'REJECTED')}
                      >
                        Reject
                      </Button>
                    )}
                    <button
                      onClick={() => handleDeleteItem('LOST', item.id, item.title)}
                      title="Permanently Delete"
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* FOUND ITEMS MODERATION TAB */}
      {activeTab === 'FOUND' && (
        <Card className="p-0 overflow-hidden border">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {foundItems.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">No found item reports.</p>
            ) : (
              foundItems.map((item) => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'}>
                        {item.status}
                      </Badge>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                    <p className="text-[11px] text-slate-400">
                      Found At: {item.found_location} • Deposited At: {item.current_location}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status !== 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleUpdateItemStatus('FOUND', item.id, 'APPROVED')}
                      >
                        Approve Listing
                      </Button>
                    )}
                    {item.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleUpdateItemStatus('FOUND', item.id, 'REJECTED')}
                      >
                        Reject
                      </Button>
                    )}
                    {item.status === 'CLAIMED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateItemStatus('FOUND', item.id, 'RETURNED')}
                      >
                        Mark Returned
                      </Button>
                    )}
                    <button
                      onClick={() => handleDeleteItem('FOUND', item.id, item.title)}
                      title="Permanently Delete"
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Claim Decision Modal */}
      <Modal
        isOpen={!!selectedClaim}
        onClose={() => setSelectedClaim(null)}
        title="Verify & Resolve Ownership Claim"
        description="Verify proof and approve or reject the student claim."
      >
        {selectedClaim && (
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">
                Item: {selectedClaim.found_items?.title}
              </p>
              <p className="text-slate-500">Claimant: {selectedClaim.profiles?.full_name} ({selectedClaim.profiles?.email})</p>
              <p className="text-slate-500">Current Holding: {selectedClaim.found_items?.current_location}</p>
            </div>

            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl text-xs space-y-1">
              <p className="font-bold text-indigo-950 dark:text-indigo-200">Claimant Proof Provided:</p>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedClaim.proof_description}</p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Review Notes / Handover Instructions
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Verified with student card. Handover approved at Security Desk."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setSelectedClaim(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={submittingReview}
                onClick={() => handleReviewClaim('REJECTED')}
              >
                Reject Claim
              </Button>
              <Button
                type="button"
                variant="success"
                isLoading={submittingReview}
                onClick={() => handleReviewClaim('APPROVED')}
              >
                Approve & Authorize Handover
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
