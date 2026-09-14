import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  MapPin,
  Calendar,
  ShieldCheck,
  FileCheck,
  Gift,
  School,
  RefreshCw,
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
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'ALL' | 'LOST' | 'FOUND' | 'MY_REPORTS' | 'MY_CLAIMS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCollege, setSelectedCollege] = useState('ALL');

  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collegesList, setCollegesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<ItemType>('LOST');
  const [claimModalItem, setClaimModalItem] = useState<FoundItem | null>(null);

  const fetchLostFoundData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Lost Items
      const { data: lostData, error: lostErr } = await supabase
        .from('lost_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (!lostErr && lostData) {
        setLostItems(lostData);
      }

      // 2. Fetch Found Items
      const { data: foundData, error: foundErr } = await supabase
        .from('found_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (!foundErr && foundData) {
        setFoundItems(foundData);
      }

      // 3. Fetch Categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'LOST_FOUND')
        .eq('is_active', true);

      if (catData) setCategories(catData);

      // 4. Fetch distinct colleges from items and colleges table
      const distinctColleges = new Set<string>();
      if (profile?.college_name) distinctColleges.add(profile.college_name);
      lostData?.forEach((i) => {
        if (i.college_name) distinctColleges.add(i.college_name);
      });
      foundData?.forEach((i) => {
        if (i.college_name) distinctColleges.add(i.college_name);
      });

      const { data: collegesTable } = await supabase.from('colleges').select('name').eq('is_active', true);
      collegesTable?.forEach((c) => distinctColleges.add(c.name));

      setCollegesList(Array.from(distinctColleges));

      // 5. Fetch User Claims
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
    } finally {
      setLoading(false);
    }
  }, [user, profile?.college_name]);

  useEffect(() => {
    fetchLostFoundData();

    // Setup Supabase Realtime Channels for instantaneous live updates
    const channel = supabase
      .channel('public:lost-found-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lost_items' },
        () => fetchLostFoundData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'found_items' },
        () => fetchLostFoundData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims' },
        () => fetchLostFoundData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLostFoundData]);

  const matchesCollege = (itemCollege?: string | null) => {
    if (selectedCollege === 'ALL') return true;
    if (!itemCollege) return false;
    return itemCollege.toLowerCase() === selectedCollege.toLowerCase();
  };

  const filteredLost = lostItems.filter((item) => {
    if (activeTab === 'MY_REPORTS' && item.user_id !== user?.id) return false;
    if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) return false;
    if (!matchesCollege(item.college_name)) return false;
    if (
      searchQuery.trim() &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.last_seen_location.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(item.college_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredFound = foundItems.filter((item) => {
    if (activeTab === 'MY_REPORTS' && item.user_id !== user?.id) return false;
    if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) return false;
    if (!matchesCollege(item.college_name)) return false;
    if (
      searchQuery.trim() &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.found_location.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(item.college_name || '').toLowerCase().includes(searchQuery.toLowerCase())
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
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Lost & Found Campus Board
            </h2>
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-pulse">
              ● Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Post misplaced belongings, browse recovered items across colleges, and file verified ownership claims.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchLostFoundData}
          >
            Refresh
          </Button>
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
              Browse All ({lostItems.length + foundItems.length})
            </button>
            <button
              onClick={() => setActiveTab('LOST')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'LOST'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Lost Items ({lostItems.length})
            </button>
            <button
              onClick={() => setActiveTab('FOUND')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'FOUND'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Found Items ({foundItems.length})
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

          <div className="flex items-center gap-2 flex-1 min-w-[240px] justify-end">
            {/* College Filter */}
            {collegesList.length > 0 && (
              <div className="relative">
                <select
                  value={selectedCollege}
                  onChange={(e) => setSelectedCollege(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">🏫 All Colleges ({collegesList.length})</option>
                  {collegesList.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search input */}
            <div className="relative min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search item, location, college..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
                    {claim.found_items.college_name && (
                      <p className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                        <School className="w-3.5 h-3.5" /> {claim.found_items.college_name}
                      </p>
                    )}
                    <p className="text-slate-500 dark:text-slate-400">
                      Deposited at: {claim.found_items.current_location}
                    </p>
                  </div>
                )}

                <div className="text-xs space-y-1 text-left">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Your Proof Details:</span>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{claim.proof_description}</p>
                </div>

                {claim.review_notes && (
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 text-left">
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
          {filteredLost.length === 0 && filteredFound.length === 0 ? (
            <div className="col-span-full py-12 text-center">
              <EmptyState
                icon={<MapPin className="w-7 h-7 text-slate-400" />}
                title="No Lost or Found Items Found"
                description={
                  searchQuery || selectedCollege !== 'ALL'
                    ? 'No items match your active search or college filters.'
                    : 'No campus items reported yet. Be the first to report a lost or found item.'
                }
              />
            </div>
          ) : (
            <>
              {/* Lost Items */}
              {(activeTab === 'ALL' || activeTab === 'LOST' || activeTab === 'MY_REPORTS') &&
                filteredLost.map((item) => (
                  <Card key={`lost-${item.id}`} hoverable className="flex flex-col justify-between overflow-hidden p-0 border shadow-sm text-left">
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
                        {item.college_name && (
                          <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-[10px] font-semibold text-white flex items-center gap-1.5 truncate">
                            <School className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span className="truncate">{item.college_name}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 pb-0 flex items-center justify-between">
                        <Badge variant="danger" size="sm">
                          LOST
                        </Badge>
                        {item.college_name && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 truncate max-w-[200px]">
                            <School className="w-3 h-3 flex-shrink-0" /> {item.college_name}
                          </span>
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
                        {item.college_name && !item.image_urls?.length && (
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium truncate">
                            <School className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{item.college_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                          <span className="truncate">Last seen: {item.last_seen_location}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Lost: {format(new Date(item.lost_date), 'MMM d, yyyy')}</span>
                        </div>
                        {item.reward_offered && (
                          <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                            <Gift className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Reward: {item.reward_offered}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

              {/* Found Items */}
              {(activeTab === 'ALL' || activeTab === 'FOUND' || activeTab === 'MY_REPORTS') &&
                filteredFound.map((item) => (
                  <Card key={`found-${item.id}`} hoverable className="flex flex-col justify-between overflow-hidden p-0 border shadow-sm text-left">
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
                        {item.college_name && (
                          <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-[10px] font-semibold text-white flex items-center gap-1.5 truncate">
                            <School className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="truncate">{item.college_name}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 pb-0 flex items-center justify-between">
                        <Badge variant="success" size="sm">
                          FOUND
                        </Badge>
                        {item.college_name && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 truncate max-w-[200px]">
                            <School className="w-3 h-3 flex-shrink-0" /> {item.college_name}
                          </span>
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
                        {item.college_name && !item.image_urls?.length && (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium truncate">
                            <School className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{item.college_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">Found at: {item.found_location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="truncate">Deposited: {item.current_location}</span>
                        </div>
                      </div>

                      {user && item.user_id !== user.id && (
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
            </>
          )}
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
