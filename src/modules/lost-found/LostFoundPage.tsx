import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  MapPin,
  Calendar,
  ShieldCheck,
  FileCheck,
  Gift,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database, ItemType } from '../../types/database.types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ReportItemModal } from './ReportItemModal';
import { SubmitClaimModal } from './SubmitClaimModal';
import { formatDistanceToNow, format } from 'date-fns';

type LostItem = Database['public']['Tables']['lost_items']['Row'];
type FoundItem = Database['public']['Tables']['found_items']['Row'];
type Claim = Database['public']['Tables']['claims']['Row'] & {
  found_items?: FoundItem;
};
type Category = Database['public']['Tables']['categories']['Row'];

export const LostFoundPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'ALL' | 'LOST' | 'FOUND' | 'MY_REPORTS' | 'MY_CLAIMS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<ItemType>('LOST');
  const [claimModalItem, setClaimModalItem] = useState<FoundItem | null>(null);

  const fetchLostFoundData = async () => {
    try {
      const { data: lostData } = await supabase
        .from('lost_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (lostData) setLostItems(lostData);

      const { data: foundData } = await supabase
        .from('found_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (foundData) setFoundItems(foundData);

      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'LOST_FOUND')
        .eq('is_active', true);

      if (catData) setCategories(catData);

      if (user) {
        const { data: claimsData } = await supabase
          .from('claims')
          .select('*, found_items(*)')
          .eq('claimant_id', user.id)
          .order('created_at', { ascending: false });

        if (claimsData) setMyClaims(claimsData as any);
      }
    } catch (err) {
      console.error('Error fetching lost & found:', err);
    }
  };

  useEffect(() => {
    fetchLostFoundData();
  }, [user]);

  const filteredLost = lostItems.filter((item) => {
    if (activeTab === 'MY_REPORTS' && item.user_id !== user?.id) return false;
    if (activeTab !== 'MY_REPORTS' && item.status !== 'APPROVED' && item.user_id !== user?.id) return false;
    if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) return false;
    if (
      searchQuery.trim() &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.last_seen_location.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredFound = foundItems.filter((item) => {
    if (activeTab === 'MY_REPORTS' && item.user_id !== user?.id) return false;
    if (activeTab !== 'MY_REPORTS' && item.status !== 'APPROVED' && item.user_id !== user?.id) return false;
    if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) return false;
    if (
      searchQuery.trim() &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.found_location.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Lost & Found Community Hub
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Report misplaced belongings, browse recovered items, and file verified ownership claims.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="danger"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setReportType('LOST');
              setIsReportModalOpen(true);
            }}
          >
            Report Lost Item
          </Button>
          <Button
            size="sm"
            variant="success"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setReportType('FOUND');
              setIsReportModalOpen(true);
            }}
          >
            Report Found Item
          </Button>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          {/* Main Navigation Tabs */}
          <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Browse All
            </button>
            <button
              onClick={() => setActiveTab('LOST')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'LOST'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Lost Items ({lostItems.filter((i) => i.status === 'APPROVED').length})
            </button>
            <button
              onClick={() => setActiveTab('FOUND')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'FOUND'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Found Items ({foundItems.filter((i) => i.status === 'APPROVED').length})
            </button>
            {user && (
              <>
                <button
                  onClick={() => setActiveTab('MY_REPORTS')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'MY_REPORTS'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  My Reports
                </button>
                <button
                  onClick={() => setActiveTab('MY_CLAIMS')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'MY_CLAIMS'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  My Claims ({myClaims.length})
                </button>
              </>
            )}
          </div>

          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search keyword or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-bold'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                selectedCategory === c.id
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-bold'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* MY CLAIMS TAB */}
      {activeTab === 'MY_CLAIMS' && (
        <div className="space-y-3">
          {myClaims.length === 0 ? (
            <EmptyState
              icon={<FileCheck className="w-6 h-6" />}
              title="No Claims Submitted"
              description="You have not filed any ownership claims yet. If you spot your item in the Found tab, submit a claim with verification proof."
            />
          ) : (
            myClaims.map((claim) => (
              <Card key={claim.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        claim.status === 'APPROVED' || claim.status === 'VERIFIED'
                          ? 'success'
                          : claim.status === 'REJECTED'
                          ? 'danger'
                          : 'warning'
                      }
                      size="md"
                    >
                      {claim.status}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Submitted {formatDistanceToNow(new Date(claim.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {claim.reviewed_at && (
                    <span className="text-[11px] text-slate-400">
                      Reviewed on {format(new Date(claim.reviewed_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>

                {claim.found_items && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">
                      Item: {claim.found_items.title}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Deposited at: {claim.found_items.current_location}
                    </p>
                  </div>
                )}

                <div className="text-xs space-y-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Your Proof Details:</span>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{claim.proof_description}</p>
                </div>

                {claim.review_notes && (
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl text-xs text-indigo-900 dark:text-indigo-200">
                    <span className="font-semibold">Moderator Note:</span> {claim.review_notes}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* ITEMS FEED */}
      {activeTab !== 'MY_CLAIMS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(activeTab === 'ALL' || activeTab === 'LOST' || activeTab === 'MY_REPORTS') &&
            filteredLost.map((item) => (
              <Card key={`lost-${item.id}`} hoverable className="flex flex-col justify-between overflow-hidden p-0 border">
                {item.image_urls && item.image_urls.length > 0 ? (
                  <div className="h-44 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                    <img
                      src={item.image_urls[0]}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge variant="danger" size="sm">
                        LOST
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 pb-0 flex items-center justify-between">
                    <Badge variant="danger" size="sm">
                      LOST
                    </Badge>
                    {item.status !== 'APPROVED' && (
                      <Badge variant="warning" size="sm">
                        {item.status}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>Last seen: {item.last_seen_location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Lost: {format(new Date(item.lost_date), 'MMM d, yyyy')}</span>
                    </div>
                    {item.reward_offered && (
                      <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                        <Gift className="w-3.5 h-3.5" />
                        <span>Reward: {item.reward_offered}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}

          {(activeTab === 'ALL' || activeTab === 'FOUND' || activeTab === 'MY_REPORTS') &&
            filteredFound.map((item) => (
              <Card key={`found-${item.id}`} hoverable className="flex flex-col justify-between overflow-hidden p-0 border">
                {item.image_urls && item.image_urls.length > 0 ? (
                  <div className="h-44 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                    <img
                      src={item.image_urls[0]}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge variant="success" size="sm">
                        FOUND
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 pb-0 flex items-center justify-between">
                    <Badge variant="success" size="sm">
                      FOUND
                    </Badge>
                    {item.status !== 'APPROVED' && (
                      <Badge variant="warning" size="sm">
                        {item.status}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Found at: {item.found_location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Deposited at: {item.current_location}</span>
                    </div>
                  </div>

                  {user && item.user_id !== user.id && item.status === 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full mt-2"
                      onClick={() => setClaimModalItem(item)}
                    >
                      This is Mine (Claim Item)
                    </Button>
                  )}
                </div>
              </Card>
            ))}
        </div>
      )}

      {/* Modals */}
      <ReportItemModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={fetchLostFoundData}
        defaultType={reportType}
      />
      <SubmitClaimModal
        isOpen={!!claimModalItem}
        onClose={() => setClaimModalItem(null)}
        onSuccess={fetchLostFoundData}
        foundItem={claimModalItem}
      />
    </div>
  );
};
