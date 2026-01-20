/**
 * Design System - Visual Reference Page
 *
 * Interactive storybook showing all design tokens, colors, typography,
 * and component variants used throughout the FFXIV Raid Planner.
 *
 * Accessible at: /docs/design-system
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CodeBlock } from '../components/docs';
import { Button } from '../components/primitives/Button';
import { Badge } from '../components/primitives/Badge';
import { IconButton } from '../components/primitives/IconButton';
import { Tooltip } from '../components/primitives/Tooltip';
import { JobIcon } from '../components/ui/JobIcon';
import { GearSourceBadge } from '../components/player/GearSourceBadge';
import { Input } from '../components/ui/Input';
import { TextArea } from '../components/ui/TextArea';
import { Label } from '../components/ui/Label';
import { InputGroup } from '../components/ui/InputGroup';
import { Checkbox } from '../components/ui/Checkbox';
import { ThreeStateCheckbox, type ThreeState } from '../components/ui/ThreeStateCheckbox';
import { Select } from '../components/ui/Select';
import { SearchableSelect, type GroupConfig } from '../components/ui/SearchableSelect';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
  DropdownCheckboxItem,
  DropdownSub,
  DropdownSubTrigger,
  DropdownSubContent,
} from '../components/primitives/Dropdown';
import { Popover, PopoverTrigger, PopoverContent } from '../components/primitives/Popover';
import { PopoverSelect, createGearSourceColorClasses } from '../components/primitives';
import { PositionSelector } from '../components/player/PositionSelector';
import { TankRoleSelector } from '../components/player/TankRoleSelector';
import type { GearSourceCategory, GearSource, RaidPosition, TankRole, SnapshotPlayer } from '../types';

// Import Lucide icons directly for the icon library display
import {
  // Navigation & UI
  Settings, Settings2, Menu, MoreVertical, MoreHorizontal,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsUpDown,
  ArrowLeft, ArrowRight, ExternalLink,
  // Actions
  Plus, PlusCircle, Minus, X, XCircle,
  Check, CheckCircle, Edit, Edit2, Pencil,
  Trash, Trash2, Copy, Clipboard, ClipboardCheck,
  Save, Download, Upload, RefreshCw, RotateCcw, Undo, Redo,
  // Search & Filter
  Search, Filter, SlidersHorizontal, ArrowUpNarrowWide, ArrowDownWideNarrow,
  // Users & Groups
  User, UserPlus, UserMinus, UserCheck, UserX, Users, UsersRound,
  // Communication
  MessageCircle, MessageSquare, Mail, Send, Share, Share2, Link, Link2, Unlink,
  // Status & Feedback
  Info, AlertCircle, AlertTriangle, AlertOctagon, CircleCheck, CircleX, HelpCircle, Loader2,
  // Data & Content
  File, FileText, FilePlus, Folder, FolderOpen, Database, Table, List, ListOrdered, LayoutGrid, LayoutList,
  // Time & Calendar
  Calendar, CalendarDays, Clock, History, Timer,
  // Media
  Eye, EyeOff, Image, Maximize, Minimize, Maximize2, Minimize2,
  // Drag & Drop
  GripVertical, GripHorizontal, Move,
  // Symbols
  Star, Heart, Bookmark, Flag, ThumbsUp, ThumbsDown, Crown, Shield, ShieldCheck, Award, Trophy, Zap, Target, Crosshair,
  // FFXIV Themed
  Swords, Sword, ShieldHalf, Wand, Wand2, Book, BookOpen, BookMarked, Scroll, Gem, Coins, Package, Gift, Box, Layers,
  // Misc UI
  LogIn, LogOut, Home, Circle, Square, Triangle, Hash, AtSign, Percent, BarChart, BarChart2, PieChart, TrendingUp, TrendingDown,
  Palette,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Icon categories for organized display
const ICON_CATEGORIES: Record<string, { name: string; icons: { name: string; icon: LucideIcon }[] }> = {
  navigation: {
    name: 'Navigation & UI',
    icons: [
      { name: 'Settings', icon: Settings },
      { name: 'Settings2', icon: Settings2 },
      { name: 'Menu', icon: Menu },
      { name: 'MoreVertical', icon: MoreVertical },
      { name: 'MoreHorizontal', icon: MoreHorizontal },
      { name: 'ChevronDown', icon: ChevronDown },
      { name: 'ChevronUp', icon: ChevronUp },
      { name: 'ChevronLeft', icon: ChevronLeft },
      { name: 'ChevronRight', icon: ChevronRight },
      { name: 'ArrowLeft', icon: ArrowLeft },
      { name: 'ArrowRight', icon: ArrowRight },
      { name: 'ExternalLink', icon: ExternalLink },
    ],
  },
  actions: {
    name: 'Actions',
    icons: [
      { name: 'Plus', icon: Plus },
      { name: 'PlusCircle', icon: PlusCircle },
      { name: 'Minus', icon: Minus },
      { name: 'X', icon: X },
      { name: 'XCircle', icon: XCircle },
      { name: 'Check', icon: Check },
      { name: 'CheckCircle', icon: CheckCircle },
      { name: 'Edit', icon: Edit },
      { name: 'Edit2', icon: Edit2 },
      { name: 'Pencil', icon: Pencil },
      { name: 'Trash', icon: Trash },
      { name: 'Trash2', icon: Trash2 },
      { name: 'Copy', icon: Copy },
      { name: 'Clipboard', icon: Clipboard },
      { name: 'ClipboardCheck', icon: ClipboardCheck },
      { name: 'Save', icon: Save },
      { name: 'Download', icon: Download },
      { name: 'Upload', icon: Upload },
      { name: 'RefreshCw', icon: RefreshCw },
      { name: 'RotateCcw', icon: RotateCcw },
      { name: 'Undo', icon: Undo },
      { name: 'Redo', icon: Redo },
    ],
  },
  search: {
    name: 'Search & Filter',
    icons: [
      { name: 'Search', icon: Search },
      { name: 'Filter', icon: Filter },
      { name: 'SlidersHorizontal', icon: SlidersHorizontal },
      { name: 'ArrowUpNarrowWide', icon: ArrowUpNarrowWide },
      { name: 'ArrowDownWideNarrow', icon: ArrowDownWideNarrow },
    ],
  },
  users: {
    name: 'Users & Groups',
    icons: [
      { name: 'User', icon: User },
      { name: 'UserPlus', icon: UserPlus },
      { name: 'UserMinus', icon: UserMinus },
      { name: 'UserCheck', icon: UserCheck },
      { name: 'UserX', icon: UserX },
      { name: 'Users', icon: Users },
      { name: 'UsersRound', icon: UsersRound },
    ],
  },
  communication: {
    name: 'Communication',
    icons: [
      { name: 'MessageCircle', icon: MessageCircle },
      { name: 'MessageSquare', icon: MessageSquare },
      { name: 'Mail', icon: Mail },
      { name: 'Send', icon: Send },
      { name: 'Share', icon: Share },
      { name: 'Share2', icon: Share2 },
      { name: 'Link', icon: Link },
      { name: 'Link2', icon: Link2 },
      { name: 'Unlink', icon: Unlink },
    ],
  },
  status: {
    name: 'Status & Feedback',
    icons: [
      { name: 'Info', icon: Info },
      { name: 'AlertCircle', icon: AlertCircle },
      { name: 'AlertTriangle', icon: AlertTriangle },
      { name: 'AlertOctagon', icon: AlertOctagon },
      { name: 'CircleCheck', icon: CircleCheck },
      { name: 'CircleX', icon: CircleX },
      { name: 'HelpCircle', icon: HelpCircle },
      { name: 'Loader2', icon: Loader2 },
    ],
  },
  data: {
    name: 'Data & Content',
    icons: [
      { name: 'File', icon: File },
      { name: 'FileText', icon: FileText },
      { name: 'FilePlus', icon: FilePlus },
      { name: 'Folder', icon: Folder },
      { name: 'FolderOpen', icon: FolderOpen },
      { name: 'Database', icon: Database },
      { name: 'Table', icon: Table },
      { name: 'List', icon: List },
      { name: 'ListOrdered', icon: ListOrdered },
      { name: 'LayoutGrid', icon: LayoutGrid },
      { name: 'LayoutList', icon: LayoutList },
    ],
  },
  time: {
    name: 'Time & Calendar',
    icons: [
      { name: 'Calendar', icon: Calendar },
      { name: 'CalendarDays', icon: CalendarDays },
      { name: 'Clock', icon: Clock },
      { name: 'History', icon: History },
      { name: 'Timer', icon: Timer },
    ],
  },
  media: {
    name: 'Media & View',
    icons: [
      { name: 'Eye', icon: Eye },
      { name: 'EyeOff', icon: EyeOff },
      { name: 'Image', icon: Image },
      { name: 'Maximize', icon: Maximize },
      { name: 'Minimize', icon: Minimize },
      { name: 'Maximize2', icon: Maximize2 },
      { name: 'Minimize2', icon: Minimize2 },
    ],
  },
  dnd: {
    name: 'Drag & Drop',
    icons: [
      { name: 'GripVertical', icon: GripVertical },
      { name: 'GripHorizontal', icon: GripHorizontal },
      { name: 'Move', icon: Move },
    ],
  },
  symbols: {
    name: 'Symbols',
    icons: [
      { name: 'Star', icon: Star },
      { name: 'Heart', icon: Heart },
      { name: 'Bookmark', icon: Bookmark },
      { name: 'Flag', icon: Flag },
      { name: 'ThumbsUp', icon: ThumbsUp },
      { name: 'ThumbsDown', icon: ThumbsDown },
      { name: 'Crown', icon: Crown },
      { name: 'Shield', icon: Shield },
      { name: 'ShieldCheck', icon: ShieldCheck },
      { name: 'Award', icon: Award },
      { name: 'Trophy', icon: Trophy },
      { name: 'Zap', icon: Zap },
      { name: 'Target', icon: Target },
      { name: 'Crosshair', icon: Crosshair },
    ],
  },
  ffxiv: {
    name: 'FFXIV Themed',
    icons: [
      { name: 'Swords', icon: Swords },
      { name: 'Sword', icon: Sword },
      { name: 'ShieldHalf', icon: ShieldHalf },
      { name: 'Wand', icon: Wand },
      { name: 'Wand2', icon: Wand2 },
      { name: 'Book', icon: Book },
      { name: 'BookOpen', icon: BookOpen },
      { name: 'BookMarked', icon: BookMarked },
      { name: 'Scroll', icon: Scroll },
      { name: 'Gem', icon: Gem },
      { name: 'Coins', icon: Coins },
      { name: 'Package', icon: Package },
      { name: 'Gift', icon: Gift },
      { name: 'Box', icon: Box },
      { name: 'Layers', icon: Layers },
    ],
  },
  misc: {
    name: 'Miscellaneous',
    icons: [
      { name: 'LogIn', icon: LogIn },
      { name: 'LogOut', icon: LogOut },
      { name: 'Home', icon: Home },
      { name: 'Circle', icon: Circle },
      { name: 'Square', icon: Square },
      { name: 'Triangle', icon: Triangle },
      { name: 'Hash', icon: Hash },
      { name: 'AtSign', icon: AtSign },
      { name: 'Percent', icon: Percent },
      { name: 'BarChart', icon: BarChart },
      { name: 'BarChart2', icon: BarChart2 },
      { name: 'PieChart', icon: PieChart },
      { name: 'TrendingUp', icon: TrendingUp },
      { name: 'TrendingDown', icon: TrendingDown },
    ],
  },
};

// Color swatch component
function ColorSwatch({
  name,
  token,
  hex,
  description,
}: {
  name: string;
  token: string;
  hex: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-12 h-12 rounded-lg border border-border-default shadow-sm"
        style={{ backgroundColor: hex }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text-primary">{name}</div>
        <div className="text-xs text-text-muted font-mono">{token}</div>
        <div className="text-xs text-text-muted">{hex}</div>
        {description && (
          <div className="text-xs text-text-secondary mt-0.5">{description}</div>
        )}
      </div>
    </div>
  );
}

// Navigation items grouped by category
const NAV_GROUPS = [
  {
    label: 'Foundations',
    items: [
      { id: 'design-principles', label: 'Design Principles' },
    ],
  },
  {
    label: 'Colors',
    items: [
      { id: 'surface-hierarchy', label: 'Surfaces' },
      { id: 'accent-colors', label: 'Accent' },
      { id: 'role-colors', label: 'Roles' },
      { id: 'floor-colors', label: 'Floors' },
      { id: 'progression-colors', label: 'Progression' },
      { id: 'membership-colors', label: 'Membership' },
      { id: 'gear-source-colors', label: 'Gear Sources' },
      { id: 'status-colors', label: 'Status' },
      { id: 'material-colors', label: 'Materials' },
      { id: 'text-colors', label: 'Text' },
    ],
  },
  {
    label: 'Typography',
    items: [
      { id: 'typography', label: 'Type Scale' },
      { id: 'spacing', label: 'Spacing' },
    ],
  },
  {
    label: 'Components',
    items: [
      { id: 'buttons', label: 'Buttons' },
      { id: 'badges', label: 'Badges' },
      { id: 'icon-buttons', label: 'Icon Buttons' },
      { id: 'icon-library', label: 'Icon Library' },
      { id: 'job-icons', label: 'Job Icons' },
      { id: 'tooltips', label: 'Tooltips' },
      { id: 'popover', label: 'Popover' },
      { id: 'tables', label: 'Tables' },
    ],
  },
  {
    label: 'Patterns',
    items: [
      { id: 'forms-inputs', label: 'Forms & Inputs' },
      { id: 'menus-navigation', label: 'Menus & Nav' },
      { id: 'tab-patterns', label: 'Tab Patterns' },
      { id: 'containers', label: 'Containers' },
      { id: 'page-layout', label: 'Page Layout' },
      { id: 'nav-panels', label: 'Nav Panels' },
    ],
  },
];

// Flat list for scroll tracking
const NAV_SECTIONS = NAV_GROUPS.flatMap(group => group.items);

// Section header component
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Subsection component
function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium text-text-primary mb-4">{title}</h3>
      {children}
    </div>
  );
}

// Icon Library Section with search and categories
function IconLibrarySection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null);

  // Get all icons flattened for search
  const allIcons = useMemo(() => {
    return Object.entries(ICON_CATEGORIES).flatMap(([category, { icons }]) =>
      icons.map(icon => ({ ...icon, category }))
    );
  }, []);

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    let icons = selectedCategory === 'all'
      ? allIcons
      : allIcons.filter(icon => icon.category === selectedCategory);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      icons = icons.filter(icon =>
        icon.name.toLowerCase().includes(query)
      );
    }

    return icons;
  }, [allIcons, selectedCategory, searchQuery]);

  // Copy icon import to clipboard
  const copyIconImport = (iconName: string) => {
    navigator.clipboard.writeText(`import { ${iconName} } from 'lucide-react';`);
    setCopiedIcon(iconName);
    setTimeout(() => setCopiedIcon(null), 2000);
  };

  const totalIconCount = allIcons.length;

  return (
    <Section id="icon-library" title="Icon Library">
      <p className="text-text-secondary mb-6">
        {totalIconCount} icons from Lucide React. Click any icon to copy import statement.
      </p>

      {/* Search and Filter Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-elevated border border-border-default rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              selectedCategory === 'all'
                ? 'bg-accent text-accent-contrast'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            All ({totalIconCount})
          </button>
          {Object.entries(ICON_CATEGORIES).map(([key, { name, icons }]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                selectedCategory === key
                  ? 'bg-accent text-accent-contrast'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {name} ({icons.length})
            </button>
          ))}
        </div>
      </div>

      {/* Icon Size Examples */}
      <Subsection title="Icon Sizes">
        <div className="flex flex-wrap gap-6 items-end mb-6 p-4 bg-surface-card rounded-lg border border-border-subtle">
          {[
            { size: 12, label: 'xs (12px)' },
            { size: 16, label: 'sm (16px)' },
            { size: 20, label: 'md (20px)' },
            { size: 24, label: 'lg (24px)' },
            { size: 32, label: 'xl (32px)' },
          ].map(({ size, label }) => (
            <div key={size} className="text-center">
              <Settings size={size} className="text-text-primary mx-auto" />
              <div className="text-xs text-text-muted mt-2">{label}</div>
            </div>
          ))}
        </div>
      </Subsection>

      {/* Stroke Width Examples */}
      <Subsection title="Stroke Width (for dark backgrounds)">
        <div className="flex flex-wrap gap-6 items-end mb-6 p-4 bg-surface-card rounded-lg border border-border-subtle">
          {[1, 1.5, 2, 2.5, 3].map((strokeWidth) => (
            <div key={strokeWidth} className="text-center">
              <Settings size={24} strokeWidth={strokeWidth} className="text-text-primary mx-auto" />
              <div className="text-xs text-text-muted mt-2">{strokeWidth}px</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mb-6">
          Default is 2px. Use 1.5-2.5px for dark backgrounds. Higher values for emphasis.
        </p>
      </Subsection>

      {/* Icon Grid */}
      <Subsection title={`Icons ${searchQuery ? `matching "${searchQuery}"` : ''} (${filteredIcons.length})`}>
        {filteredIcons.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            No icons found matching "{searchQuery}"
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
            {filteredIcons.map(({ name, icon: IconComponent }) => (
              <Tooltip key={name} content={copiedIcon === name ? 'Copied!' : name}>
                <button
                  onClick={() => copyIconImport(name)}
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-lg
                    bg-surface-card border border-border-subtle
                    hover:border-accent/50 hover:bg-surface-elevated
                    transition-all group
                    ${copiedIcon === name ? 'border-accent bg-accent/10' : ''}
                  `}
                >
                  <IconComponent
                    size={20}
                    className={`
                      ${copiedIcon === name ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}
                      transition-colors
                    `}
                  />
                </button>
              </Tooltip>
            ))}
          </div>
        )}
      </Subsection>

      {/* Usage Code Example */}
      <Subsection title="Usage">
        <CodeBlock
          language="tsx"
          code={`// Import directly
import { Settings, Trash2, Plus } from 'lucide-react';

// Use in JSX
<Settings className="w-4 h-4 text-text-secondary" />
<Trash2 size={16} strokeWidth={2} />

// With custom color
<Plus className="w-5 h-5 text-accent" />

// In IconButton
<IconButton
  icon={<Settings className="w-4 h-4" />}
  label="Settings"
/>`}
        />
      </Subsection>
    </Section>
  );
}

// Sortable Table Demo with interactive sorting
function SortableTableDemo() {
  type SortField = 'name' | 'status' | 'count';
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const data = [
    { name: 'Alpha Team', status: 'Active', count: 8 },
    { name: 'Beta Squad', status: 'Inactive', count: 4 },
    { name: 'Gamma Unit', status: 'Active', count: 6 },
    { name: 'Delta Force', status: 'Pending', count: 3 },
  ];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * modifier;
    }
    return ((aVal as number) - (bVal as number)) * modifier;
  });

  const renderHeader = (field: SortField, label: string, align: 'left' | 'center' = 'left') => {
    const isActive = sortField === field;
    const justifyClass = align === 'center' ? 'justify-center' : '';

    return (
      <th
        className="group text-left px-4 py-3 font-medium text-text-secondary cursor-pointer hover:text-text-primary select-none transition-colors"
        onClick={() => handleSort(field)}
        aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <span className={`flex items-center gap-1 ${justifyClass}`}>
          {label}
          {isActive ? (
            <span className="text-accent">
              {sortDirection === 'asc' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          ) : (
            <span className="opacity-0 group-hover:opacity-50 transition-opacity">
              <ChevronsUpDown className="w-4 h-4" />
            </span>
          )}
        </span>
      </th>
    );
  };

  return (
    <div className="bg-surface-elevated rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-text-primary">Interactive Example</div>
        <div className="text-xs text-text-muted">
          Sorting by: <span className="text-accent">{sortField}</span> ({sortDirection})
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-card">
              {renderHeader('name', 'Name')}
              {renderHeader('status', 'Status')}
              {renderHeader('count', 'Count', 'center')}
              <th className="text-left px-4 py-3 font-medium text-text-secondary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sortedData.map((row) => (
              <tr key={row.name} className="hover:bg-surface-interactive transition-colors">
                <td className="px-4 py-3 text-accent">{row.name}</td>
                <td className="px-4 py-3 text-text-secondary">{row.status}</td>
                <td className="px-4 py-3 text-center text-text-secondary">{row.count}</td>
                <td className="px-4 py-3 text-text-muted">View</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted mt-3">
        Click column headers to sort. Click again to reverse direction.
      </p>
    </div>
  );
}

// Forms & Inputs Section with interactive examples
function FormsSection() {
  // State for form demos
  const [textValue, setTextValue] = useState('');
  const [errorValue, setErrorValue] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [inputGroupValue, setInputGroupValue] = useState('');
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [threeState, setThreeState] = useState<ThreeState>('none');
  const [selectValue, setSelectValue] = useState('');
  const [searchableSelectValue, setSearchableSelectValue] = useState('');
  const [categorizedSelectValue, setCategorizedSelectValue] = useState('');

  // Sample data for categorized dropdown demo
  const ROLE_GROUP_CONFIG: Record<string, GroupConfig> = {
    owner: { name: 'Owners', color: 'var(--color-membership-owner)' },
    lead: { name: 'Leads', color: 'var(--color-membership-lead)' },
    member: { name: 'Members', color: 'var(--color-membership-member)' },
    linked: { name: 'Linked Users', color: 'var(--color-membership-linked)' },
  };

  const categorizedUserOptions = [
    { value: 'user1', label: 'Alice (Owner)', group: 'Owners', icon: <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide bg-membership-owner/30 text-membership-owner border-membership-owner/50">Owner</span> },
    { value: 'user2', label: 'Bob (Lead)', group: 'Leads', icon: <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide bg-membership-lead/30 text-membership-lead border-membership-lead/50">Lead</span> },
    { value: 'user3', label: 'Charlie (Lead)', group: 'Leads', icon: <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide bg-membership-lead/30 text-membership-lead border-membership-lead/50">Lead</span> },
    { value: 'user4', label: 'Diana (Member)', group: 'Members', icon: <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide bg-membership-member/30 text-membership-member border-membership-member/50">Member</span> },
    { value: 'user5', label: 'Eve (Member)', group: 'Members', icon: <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide bg-membership-member/30 text-membership-member border-membership-member/50">Member</span> },
    { value: 'user6', label: 'Frank (Member)', group: 'Members', icon: <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide bg-membership-member/30 text-membership-member border-membership-member/50">Member</span> },
    { value: 'user7', label: 'Grace (Linked)', group: 'Linked Users', icon: <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide bg-membership-linked/30 text-membership-linked border-membership-linked/50">Linked</span> },
  ];

  const categorizedGroupOrder = ['owner', 'lead', 'member', 'linked'].map(r => ROLE_GROUP_CONFIG[r]);

  return (
    <Section id="forms-inputs" title="Forms & Inputs">
      <p className="text-text-secondary mb-6">
        Form elements with consistent styling, states, and accessibility.
      </p>

      {/* Text Inputs */}
      <Subsection title="Text Input">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Default */}
          <div>
            <Label htmlFor="input-default">Default Input</Label>
            <Input
              id="input-default"
              value={textValue}
              onChange={setTextValue}
              placeholder="Enter text..."
            />
          </div>

          {/* With Error */}
          <div>
            <Label htmlFor="input-error">With Error</Label>
            <Input
              id="input-error"
              value={errorValue}
              onChange={setErrorValue}
              placeholder="Invalid input"
              error="This field is required"
            />
          </div>

          {/* Disabled */}
          <div>
            <Label htmlFor="input-disabled" disabled>Disabled</Label>
            <Input
              id="input-disabled"
              value="Cannot edit"
              onChange={() => {}}
              disabled
            />
          </div>
        </div>
      </Subsection>

      {/* Input Sizes */}
      <Subsection title="Input Sizes">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px] max-w-[200px]">
            <Label size="sm">Small</Label>
            <Input value="" onChange={() => {}} placeholder="Small" size="sm" />
          </div>
          <div className="flex-1 min-w-[150px] max-w-[200px]">
            <Label>Medium</Label>
            <Input value="" onChange={() => {}} placeholder="Medium" size="md" />
          </div>
          <div className="flex-1 min-w-[150px] max-w-[200px]">
            <Label>Large</Label>
            <Input value="" onChange={() => {}} placeholder="Large" size="lg" />
          </div>
        </div>
      </Subsection>

      {/* Input with Icons */}
      <Subsection title="Input with Icons">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <Label>Search Input</Label>
            <Input
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search..."
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div>
            <Label>With Right Icon</Label>
            <Input
              value=""
              onChange={() => {}}
              placeholder="Amount"
              rightIcon={<span className="text-text-muted text-sm">USD</span>}
            />
          </div>
        </div>
      </Subsection>

      {/* Input Group */}
      <Subsection title="Input Group (Label + Input)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <InputGroup
            label="Player Name"
            value={inputGroupValue}
            onChange={setInputGroupValue}
            placeholder="Enter player name"
            required
          />
          <InputGroup
            label="Discord ID"
            value=""
            onChange={() => {}}
            placeholder="username#0000"
            description="Used for notifications"
          />
        </div>
      </Subsection>

      {/* TextArea */}
      <Subsection title="Text Area">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Notes</Label>
            <TextArea
              value={textareaValue}
              onChange={setTextareaValue}
              placeholder="Add notes..."
              rows={4}
            />
          </div>
          <div>
            <Label>With Error</Label>
            <TextArea
              value=""
              onChange={() => {}}
              placeholder="Description"
              error="Description is too short"
              rows={4}
            />
          </div>
        </div>
      </Subsection>

      {/* Select */}
      <Subsection title="Select Dropdown">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl">
          <div>
            <Label>Role Selection</Label>
            <Select
              value={selectValue}
              onChange={setSelectValue}
              placeholder="Select a role..."
              options={[
                { value: 'tank', label: 'Tank' },
                { value: 'healer', label: 'Healer' },
                { value: 'melee', label: 'Melee DPS' },
                { value: 'ranged', label: 'Ranged DPS' },
                { value: 'caster', label: 'Caster' },
              ]}
            />
          </div>
          <div>
            <Label>With Selection</Label>
            <Select
              value="healer"
              onChange={() => {}}
              options={[
                { value: 'tank', label: 'Tank' },
                { value: 'healer', label: 'Healer' },
                { value: 'melee', label: 'Melee DPS' },
              ]}
            />
          </div>
        </div>
      </Subsection>

      {/* Searchable Select */}
      <Subsection title="Searchable Select">
        <p className="text-sm text-text-muted mb-4">
          Filterable dropdown for large lists. Supports search, icons, and keyboard navigation.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl">
          <div>
            <Label>Basic Searchable</Label>
            <SearchableSelect
              value={searchableSelectValue}
              onChange={setSearchableSelectValue}
              placeholder="Select a job..."
              searchPlaceholder="Search jobs..."
              options={[
                { value: 'pld', label: 'Paladin' },
                { value: 'war', label: 'Warrior' },
                { value: 'drk', label: 'Dark Knight' },
                { value: 'gnb', label: 'Gunbreaker' },
                { value: 'whm', label: 'White Mage' },
                { value: 'sch', label: 'Scholar' },
                { value: 'ast', label: 'Astrologian' },
                { value: 'sge', label: 'Sage' },
              ]}
            />
          </div>
          <div>
            <Label>With Clearable</Label>
            <SearchableSelect
              value="whm"
              onChange={() => {}}
              clearable
              options={[
                { value: 'whm', label: 'White Mage' },
                { value: 'sch', label: 'Scholar' },
                { value: 'ast', label: 'Astrologian' },
                { value: 'sge', label: 'Sage' },
              ]}
            />
          </div>
        </div>
      </Subsection>

      {/* Categorized Dropdown */}
      <Subsection title="Categorized Dropdown">
        <p className="text-sm text-text-muted mb-4">
          SearchableSelect with grouped options and colored headers. Groups have sticky headers,
          colored text matching role/category, and subtle colored highlights on selection.
          Search also matches group names (try typing "owner" or "member").
        </p>
        <div className="max-w-sm">
          <Label>User Assignment (Categorized)</Label>
          <SearchableSelect
            value={categorizedSelectValue}
            onChange={setCategorizedSelectValue}
            placeholder="Select user..."
            searchPlaceholder="Search by name or role..."
            emptyMessage="No matching users"
            options={categorizedUserOptions}
            groupOrder={categorizedGroupOrder}
          />
        </div>
        <div className="mt-6 p-4 bg-surface-elevated rounded-lg">
          <h4 className="text-sm font-medium text-text-primary mb-3">Features</h4>
          <ul className="text-sm text-text-secondary space-y-1.5">
            <li>• <strong>Sticky Headers</strong> - Group headers stay visible while scrolling</li>
            <li>• <strong>Colored Headers</strong> - Each group uses its semantic color (CSS variables)</li>
            <li>• <strong>Smart Filtering</strong> - Search matches both labels AND group names</li>
            <li>• <strong>Keyboard Navigation</strong> - Arrow keys work seamlessly across groups</li>
            <li>• <strong>Subtle Highlighting</strong> - Selection uses <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">color-mix</code> with 15% group color</li>
          </ul>
        </div>
        <div className="mt-4">
          <h4 className="text-sm font-medium text-text-primary mb-3">Usage</h4>
          <CodeBlock language="tsx" code={`const GROUP_CONFIG = {
  owner: { name: 'Owners', color: 'var(--color-membership-owner)' },
  lead: { name: 'Leads', color: 'var(--color-membership-lead)' },
  member: { name: 'Members', color: 'var(--color-membership-member)' },
};

const options = users.map(u => ({
  value: u.id,
  label: u.name,
  group: GROUP_CONFIG[u.role].name,
  icon: <RoleBadge role={u.role} />,
}));

<SearchableSelect
  options={options}
  groupOrder={Object.values(GROUP_CONFIG)}
  ...
/>`} />
        </div>
      </Subsection>

      {/* Checkboxes */}
      <Subsection title="Checkboxes">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <Checkbox
              checked={checkboxValue}
              onChange={setCheckboxValue}
              label="Default checkbox"
            />
            <Checkbox
              checked={true}
              onChange={() => {}}
              label="Checked"
            />
            <Checkbox
              checked={false}
              onChange={() => {}}
              label="Disabled"
              disabled
            />
            <Checkbox
              checked={true}
              onChange={() => {}}
              label="Checked & Disabled"
              disabled
            />
          </div>
        </div>
      </Subsection>

      {/* ThreeStateCheckbox */}
      <Subsection title="Three-State Checkbox (Tome Gear)">
        <p className="text-sm text-text-muted mb-4">
          Cycles through: empty → have → augmented. Used for tome BiS gear tracking.
        </p>
        <div className="flex flex-wrap gap-8 items-center">
          <div className="flex items-center gap-3">
            <ThreeStateCheckbox
              state={threeState}
              onChange={setThreeState}
            />
            <span className="text-sm text-text-secondary">
              Interactive ({threeState})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThreeStateCheckbox
              state="none"
              onChange={() => {}}
            />
            <span className="text-sm text-text-muted">None (empty)</span>
          </div>
          <div className="flex items-center gap-3">
            <ThreeStateCheckbox
              state="have"
              onChange={() => {}}
            />
            <span className="text-sm text-text-muted">Have (checkmark)</span>
          </div>
          <div className="flex items-center gap-3">
            <ThreeStateCheckbox
              state="augmented"
              onChange={() => {}}
            />
            <span className="text-sm text-text-muted">Augmented (filled)</span>
          </div>
          <div className="flex items-center gap-3">
            <ThreeStateCheckbox
              state="have"
              onChange={() => {}}
              disabled
            />
            <span className="text-sm text-text-muted">Disabled</span>
          </div>
        </div>
      </Subsection>

      {/* Labels */}
      <Subsection title="Labels">
        <div className="flex flex-wrap gap-8">
          <div>
            <Label>Default Label</Label>
            <div className="text-xs text-text-muted mt-1">Standard label</div>
          </div>
          <div>
            <Label required>Required Label</Label>
            <div className="text-xs text-text-muted mt-1">With asterisk</div>
          </div>
          <div>
            <Label size="sm">Small Label</Label>
            <div className="text-xs text-text-muted mt-1">Smaller text</div>
          </div>
          <div>
            <Label description="Additional context here">With Description</Label>
            <div className="text-xs text-text-muted mt-1">Helper text below</div>
          </div>
          <div>
            <Label disabled>Disabled Label</Label>
            <div className="text-xs text-text-muted mt-1">Muted styling</div>
          </div>
        </div>
      </Subsection>

      {/* Form Layout Example */}
      <Subsection title="Form Layout Example">
        <div className="bg-surface-card border border-border-subtle rounded-lg p-6 max-w-lg">
          <h4 className="text-lg font-medium text-text-primary mb-4">Add New Player</h4>
          <div className="space-y-4">
            <InputGroup
              label="Character Name"
              value=""
              onChange={() => {}}
              placeholder="Warrior of Light"
              required
            />
            <div>
              <Label>Job</Label>
              <Select
                value=""
                onChange={() => {}}
                placeholder="Select job..."
                options={[
                  { value: 'DRK', label: 'Dark Knight' },
                  { value: 'WAR', label: 'Warrior' },
                  { value: 'WHM', label: 'White Mage' },
                ]}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <TextArea
                value=""
                onChange={() => {}}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
            <Checkbox
              checked={false}
              onChange={() => {}}
              label="Mark as substitute"
            />
            <div className="flex gap-3 pt-2">
              <Button variant="primary">Add Player</Button>
              <Button variant="ghost">Cancel</Button>
            </div>
          </div>
        </div>
      </Subsection>

      {/* Usage Code */}
      <Subsection title="Usage">
        <CodeBlock
          language="tsx"
          code={`// Import components
import { Input, TextArea, Label, InputGroup, Checkbox, Select } from '@/components/ui';
import { ThreeStateCheckbox } from '@/components/ui/ThreeStateCheckbox';

// Basic Input
<Input
  value={name}
  onChange={setName}
  placeholder="Enter name"
  error={errors.name}
/>

// Input with icon
<Input
  value={search}
  onChange={setSearch}
  leftIcon={<Search className="w-4 h-4" />}
/>

// InputGroup (label + input)
<InputGroup
  label="Email"
  value={email}
  onChange={setEmail}
  required
  description="We'll never share your email"
/>

// ThreeStateCheckbox for tome gear
<ThreeStateCheckbox
  state={gearState}  // 'none' | 'have' | 'augmented'
  onChange={setGearState}
/>`}
        />
      </Subsection>
    </Section>
  );
}

// Popover Section - Floating content and badge-style selectors
function PopoverSection() {
  const [bisSourceValue, setBisSourceValue] = useState<GearSource>('raid');
  const [positionValue, setPositionValue] = useState<RaidPosition | null>('T1');
  const [tankRoleValue, setTankRoleValue] = useState<TankRole | null>('MT');

  // Derive role from selected position (T→tank, H→healer, M→melee, R→ranged)
  const getRoleFromPosition = (pos: RaidPosition | null): 'tank' | 'healer' | 'melee' | 'ranged' => {
    if (!pos) return 'tank';
    if (pos.startsWith('T')) return 'tank';
    if (pos.startsWith('H')) return 'healer';
    if (pos.startsWith('M')) return 'melee';
    return 'ranged';
  };
  const derivedRole = getRoleFromPosition(positionValue);

  // Mock player for selector demos (owner role allows editing)
  const mockPlayer: SnapshotPlayer = {
    id: 'demo-player',
    tierSnapshotId: 'demo-tier',
    name: 'Demo Player',
    job: 'PLD',
    role: derivedRole,
    position: positionValue ?? undefined,
    tankRole: tankRoleValue ?? undefined,
    configured: true,
    sortOrder: 0,
    gear: [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    isSubstitute: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <Section id="popover" title="Popover">
      <p className="text-text-secondary mb-6">
        Floating content triggered by user interaction. Use for custom content (forms, grids) or standardized badge-style selectors.
      </p>

      {/* Basic Popover */}
      <Subsection title="Basic Popover">
        <p className="text-sm text-text-muted mb-4">
          For custom floating content. Unlike dropdowns, can contain any content (forms, grids, etc).
        </p>
        <div className="flex flex-wrap gap-4">
          <Popover>
            <PopoverTrigger>
              <Button variant="secondary">Simple Popover</Button>
            </PopoverTrigger>
            <PopoverContent className="p-4 w-64">
              <h4 className="font-medium text-text-primary mb-2">Popover Title</h4>
              <p className="text-sm text-text-secondary">
                This is a simple popover with text content. Click outside to close.
              </p>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger>
              <Button variant="secondary">With Form</Button>
            </PopoverTrigger>
            <PopoverContent className="p-4 w-72">
              <h4 className="font-medium text-text-primary mb-3">Quick Edit</h4>
              <div className="space-y-3">
                <div>
                  <Label size="sm">Name</Label>
                  <Input
                    value=""
                    onChange={() => {}}
                    placeholder="Enter name..."
                    size="sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary">Save</Button>
                  <Button size="sm" variant="ghost">Cancel</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger>
              <Button variant="secondary">Position Options</Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="p-4">
              <p className="text-sm text-text-secondary">Opens to the right</p>
              <p className="text-xs text-text-muted mt-1">side="right" align="start"</p>
            </PopoverContent>
          </Popover>
        </div>
      </Subsection>

      {/* PopoverSelect - Badge-style Selectors */}
      <Subsection title="PopoverSelect (Badge-style Selectors)">
        <p className="text-sm text-text-muted mb-4">
          Standardized badge-style popover selectors. Used for compact selections like Position, Tank Role, and BiS Source.
          All share consistent styling: <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">text-xs font-bold</code>, solid background when selected, 20% opacity when not.
        </p>

        {/* Design Standards */}
        <div className="bg-surface-elevated rounded-lg p-4 mb-4">
          <h4 className="font-medium text-text-primary mb-2">Design Standards</h4>
          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div>
              <div className="text-text-muted mb-1">Trigger</div>
              <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">px-1.5 py-0.5 rounded text-xs font-bold</code>
            </div>
            <div>
              <div className="text-text-muted mb-1">Dropdown Items</div>
              <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">px-2 py-1.5 rounded text-xs font-bold</code>
            </div>
            <div>
              <div className="text-text-muted mb-1">Selected State</div>
              <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">bg-{'{color}'} text-surface-base</code>
            </div>
            <div>
              <div className="text-text-muted mb-1">Suggested (Unselected)</div>
              <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">bg-{'{color}'}/20 text-{'{color}'} hover:bg-{'{color}'}/30</code>
            </div>
          </div>
          <div className="text-xs border-t border-border-default pt-3">
            <div className="text-text-muted mb-1">Not Suggested (Grayed Out)</div>
            <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">bg-surface-base text-text-muted hover:bg-surface-interactive</code>
            <p className="text-text-muted mt-2">
              For PositionSelector, only positions matching the player's role are colored. Others are grayed out to guide selection.
            </p>
          </div>
        </div>

        {/* Interactive Examples */}
        <div className="flex flex-wrap items-start gap-8">
          {/* Position Selector */}
          <div>
            <div className="text-xs text-text-muted mb-2">PositionSelector</div>
            <PositionSelector
              position={positionValue ?? undefined}
              role={derivedRole}
              onSelect={(pos) => setPositionValue(pos ?? null)}
              player={mockPlayer}
              userRole="owner"
            />
            <p className="text-xs text-text-muted mt-1">
              Role derived from position: <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">{derivedRole}</code>
            </p>
          </div>

          {/* Tank Role Selector */}
          <div>
            <div className="text-xs text-text-muted mb-2">TankRoleSelector</div>
            <TankRoleSelector
              tankRole={tankRoleValue ?? undefined}
              onSelect={(role) => setTankRoleValue(role ?? null)}
              player={mockPlayer}
              userRole="owner"
            />
            <p className="text-xs text-text-muted mt-1">
              Current: <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">{tankRoleValue ?? 'none'}</code>
            </p>
          </div>

          {/* BiS Source Selector */}
          <div>
            <div className="text-xs text-text-muted mb-2">BiS Source (PopoverSelect)</div>
            <PopoverSelect
              value={bisSourceValue}
              options={[
                { value: 'raid', label: 'Raid', colorClasses: createGearSourceColorClasses('raid') },
                { value: 'tome', label: 'Tome', colorClasses: createGearSourceColorClasses('tome') },
                { value: 'crafted', label: 'Crafted', colorClasses: createGearSourceColorClasses('crafted') },
              ]}
              onSelect={(v) => setBisSourceValue(v as GearSource ?? 'raid')}
              layout="vertical"
              placeholder="--"
              triggerWidth="w-16"
              contentWidth="w-20"
              showIcons={false}
              getTriggerClasses={(v) => {
                if (!v) return 'bg-surface-interactive text-text-muted hover:text-text-secondary';
                if (v === 'raid') return 'bg-gear-raid/20 text-gear-raid hover:bg-gear-raid/30';
                if (v === 'tome') return 'bg-gear-tome/20 text-gear-tome hover:bg-gear-tome/30';
                return 'bg-gear-crafted/20 text-gear-crafted hover:bg-gear-crafted/30';
              }}
            />
            <p className="text-xs text-text-muted mt-1">
              Current: <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">{bisSourceValue}</code>
            </p>
          </div>

        </div>
      </Subsection>

      {/* Color Helpers */}
      <Subsection title="Color Helpers">
        <div className="bg-surface-elevated rounded-lg p-4">
          <div className="text-sm text-text-secondary space-y-2">
            <p><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">createRoleColorClasses('T')</code> → Tank colors (blue)</p>
            <p><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">createRoleColorClasses('H')</code> → Healer colors (green)</p>
            <p><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">createRoleColorClasses('M')</code> → DPS colors (red)</p>
            <p><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">createGearSourceColorClasses('raid')</code> → Raid colors (pink)</p>
            <p><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">createGearSourceColorClasses('tome')</code> → Tome colors (teal)</p>
            <p><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">createGearSourceColorClasses('crafted')</code> → Crafted colors (orange)</p>
          </div>
        </div>
      </Subsection>
    </Section>
  );
}

function MenusSection() {
  const [dropdownCheckbox1, setDropdownCheckbox1] = useState(true);
  const [dropdownCheckbox2, setDropdownCheckbox2] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'loot' | 'log'>('roster');
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <Section id="menus-navigation" title="Menus & Navigation">
      <p className="text-text-secondary mb-6">
        Dropdown menus, context menus, popovers, and tab navigation patterns.
      </p>

      {/* Dropdown Menu */}
      <Subsection title="Dropdown Menu">
        <p className="text-sm text-text-muted mb-4">
          Click to open. Supports icons, shortcuts, checkboxes, separators, labels, and submenus.
        </p>
        <div className="flex flex-wrap gap-4">
          {/* Basic Dropdown */}
          <Dropdown>
            <DropdownTrigger>
              <Button variant="secondary" rightIcon={<ChevronDown className="w-4 h-4" />}>
                Basic Menu
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem icon={<Edit className="w-4 h-4" />} onSelect={() => {}}>
                Edit
              </DropdownItem>
              <DropdownItem icon={<Copy className="w-4 h-4" />} shortcut="⌘C" onSelect={() => {}}>
                Copy
              </DropdownItem>
              <DropdownItem icon={<Share className="w-4 h-4" />} onSelect={() => {}}>
                Share
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onSelect={() => {}}>
                Delete
              </DropdownItem>
            </DropdownContent>
          </Dropdown>

          {/* With Checkboxes */}
          <Dropdown>
            <DropdownTrigger>
              <Button variant="secondary" rightIcon={<ChevronDown className="w-4 h-4" />}>
                With Checkboxes
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>View Options</DropdownLabel>
              <DropdownCheckboxItem
                checked={dropdownCheckbox1}
                onCheckedChange={setDropdownCheckbox1}
              >
                Show completed
              </DropdownCheckboxItem>
              <DropdownCheckboxItem
                checked={dropdownCheckbox2}
                onCheckedChange={setDropdownCheckbox2}
              >
                Show substitutes
              </DropdownCheckboxItem>
            </DropdownContent>
          </Dropdown>

          {/* With Submenu */}
          <Dropdown>
            <DropdownTrigger>
              <Button variant="secondary" rightIcon={<ChevronDown className="w-4 h-4" />}>
                With Submenu
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem icon={<Settings className="w-4 h-4" />} onSelect={() => {}}>
                Settings
              </DropdownItem>
              <DropdownSub>
                <DropdownSubTrigger icon={<Users className="w-4 h-4" />}>
                  Team
                </DropdownSubTrigger>
                <DropdownSubContent>
                  <DropdownItem onSelect={() => {}}>View Members</DropdownItem>
                  <DropdownItem onSelect={() => {}}>Invite Player</DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem danger onSelect={() => {}}>Leave Team</DropdownItem>
                </DropdownSubContent>
              </DropdownSub>
              <DropdownSeparator />
              <DropdownItem disabled>Disabled Item</DropdownItem>
            </DropdownContent>
          </Dropdown>

          {/* Icon Button Trigger */}
          <Dropdown>
            <DropdownTrigger>
              <IconButton
                icon={<MoreVertical className="w-4 h-4" />}
                aria-label="More options"
              />
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownItem icon={<Edit className="w-4 h-4" />} onSelect={() => {}}>
                Edit Player
              </DropdownItem>
              <DropdownItem icon={<RefreshCw className="w-4 h-4" />} onSelect={() => {}}>
                Reset Gear
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onSelect={() => {}}>
                Remove Player
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </Subsection>

      {/* Context Menu */}
      <Subsection title="Context Menu">
        <p className="text-sm text-text-muted mb-4">
          Right-click activated menu. Position auto-adjusts to stay in viewport.
        </p>
        <div
          className="relative bg-surface-card border border-border-subtle rounded-lg p-8 text-center cursor-context-menu"
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenuPos({ x: e.clientX, y: e.clientY });
          }}
        >
          <p className="text-text-secondary">Right-click anywhere in this area</p>
          <p className="text-xs text-text-muted mt-2">(Context menu will appear at cursor position)</p>
        </div>
        {contextMenuPos && (
          <div
            className="fixed z-50 bg-surface-overlay border border-border-default rounded-lg shadow-xl py-1 min-w-40 animate-in fade-in-0 zoom-in-95"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 text-text-primary hover:bg-surface-interactive"
              onClick={() => setContextMenuPos(null)}
            >
              <Edit className="w-4 h-4" /> Edit
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 text-text-primary hover:bg-surface-interactive"
              onClick={() => setContextMenuPos(null)}
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <div className="my-1 border-t border-border-default" />
            <button
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 text-status-error hover:bg-status-error/10"
              onClick={() => setContextMenuPos(null)}
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
        {contextMenuPos && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenuPos(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuPos({ x: e.clientX, y: e.clientY });
            }}
          />
        )}
      </Subsection>

      {/* Tab Navigation */}
      <Subsection title="Tab Navigation">
        <p className="text-sm text-text-muted mb-4">
          Segmented control for switching between views. Active tab has accent border.
        </p>
        <div className="flex gap-1 bg-surface-raised rounded-lg p-1 w-fit">
          {(['roster', 'loot', 'log'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border
                ${
                  activeTab === tab
                    ? 'bg-surface-elevated text-text-primary border-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-transparent'
                }
              `}
            >
              {tab === 'roster' && <Users className="w-4 h-4" />}
              {tab === 'loot' && <Package className="w-4 h-4" />}
              {tab === 'log' && <History className="w-4 h-4" />}
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-2">
          Current: <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">{activeTab}</code>
        </p>
      </Subsection>

      {/* Menu Item Variants */}
      <Subsection title="Menu Item Variants">
        <p className="text-sm text-text-muted mb-4">
          Different states and styles for menu items.
        </p>
        <div className="bg-surface-overlay border border-border-default rounded-lg py-1 w-64">
          <div className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
            Label
          </div>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-interactive">
            <Edit className="w-4 h-4" />
            <span className="flex-1 text-left">With Icon</span>
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-interactive">
            <span className="flex-1 text-left">With Shortcut</span>
            <span className="text-xs text-text-muted">⌘K</span>
          </button>
          <div className="my-1 h-px bg-border-default" />
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-interactive">
            <span className="w-4 h-4 flex items-center justify-center">
              <Check className="w-4 h-4 text-accent" />
            </span>
            <span className="flex-1 text-left">Checkbox (checked)</span>
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-interactive">
            <span className="w-4 h-4" />
            <span className="flex-1 text-left">Checkbox (unchecked)</span>
          </button>
          <div className="my-1 h-px bg-border-default" />
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm opacity-50 cursor-not-allowed">
            <span className="flex-1 text-left">Disabled Item</span>
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-status-error hover:bg-status-error/10">
            <Trash2 className="w-4 h-4" />
            <span className="flex-1 text-left">Danger Item</span>
          </button>
        </div>
      </Subsection>

      {/* Usage Code */}
      <Subsection title="Usage">
        <CodeBlock
          language="tsx"
          code={`// Dropdown Menu
import {
  Dropdown, DropdownTrigger, DropdownContent,
  DropdownItem, DropdownSeparator, DropdownLabel,
  DropdownCheckboxItem, DropdownSub, DropdownSubTrigger, DropdownSubContent
} from '@/components/primitives/Dropdown';

<Dropdown>
  <DropdownTrigger>
    <Button>Open Menu</Button>
  </DropdownTrigger>
  <DropdownContent>
    <DropdownLabel>Actions</DropdownLabel>
    <DropdownItem icon={<Edit />} onSelect={handleEdit}>Edit</DropdownItem>
    <DropdownItem shortcut="⌘C" onSelect={handleCopy}>Copy</DropdownItem>
    <DropdownSeparator />
    <DropdownItem danger onSelect={handleDelete}>Delete</DropdownItem>
  </DropdownContent>
</Dropdown>

// Popover
import { Popover, PopoverTrigger, PopoverContent } from '@/components/primitives/Popover';

<Popover>
  <PopoverTrigger>
    <Button>Open Popover</Button>
  </PopoverTrigger>
  <PopoverContent side="bottom" align="start" className="p-4">
    {/* Custom content */}
  </PopoverContent>
</Popover>`}
        />
      </Subsection>
    </Section>
  );
}

// Tab Patterns Section
function TabPatternsSection() {
  return (
    <Section id="tab-patterns" title="Tab Patterns">
      <p className="text-text-secondary mb-6">
        Different tab structures serve different purposes. Understanding when to use each pattern
        ensures consistent UX across the application.
      </p>

      {/* Pattern 1: Content Variant Tabs */}
      <Subsection title="Content Variant Tabs">
        <p className="text-sm text-text-muted mb-4">
          Use for showing the same data in different visualizations. Tabs appear inside the section header.
        </p>
        <div className="bg-surface-elevated p-4 rounded-lg border border-border-default mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-text-primary font-medium">Loot Priority</h3>
            <div className="flex bg-surface-base rounded-lg p-0.5">
              <button className="px-3 py-1 text-sm rounded bg-accent text-accent-contrast font-bold">
                Who Needs It
              </button>
              <button className="px-3 py-1 text-sm rounded text-text-secondary">
                Gear Priority
              </button>
              <button className="px-3 py-1 text-sm rounded text-text-secondary">
                Weapon Priority
              </button>
            </div>
          </div>
          <div className="h-24 bg-surface-base rounded border border-border-subtle flex items-center justify-center text-text-muted">
            Content area - same data, different view
          </div>
        </div>
        <div className="text-sm text-text-muted">
          <strong className="text-text-primary">Use cases:</strong> Loot tab subtabs (Who Needs It, Gear Priority, Weapon Priority)
        </div>
      </Subsection>

      {/* Pattern 2: Layout Mode Toggles */}
      <Subsection title="Layout Mode Toggles">
        <p className="text-sm text-text-muted mb-4">
          Use for fundamentally different UI layouts. Toggles appear at the top level, separate from content.
        </p>
        <div className="bg-surface-elevated p-4 rounded-lg border border-border-default mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex bg-surface-base rounded-lg p-0.5">
              <button className="px-3 py-1 text-sm rounded bg-accent text-accent-contrast font-bold flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                Grid
              </button>
              <button className="px-3 py-1 text-sm rounded text-text-secondary flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                List
              </button>
            </div>
            <button className="px-3 py-1.5 text-sm font-semibold text-status-error bg-status-error/10 border border-status-error/40 rounded-lg flex items-center gap-1.5">
              Reset
            </button>
          </div>
          <div className="h-24 bg-surface-base rounded border border-border-subtle flex items-center justify-center text-text-muted">
            Completely different layout structure
          </div>
        </div>
        <div className="text-sm text-text-muted">
          <strong className="text-text-primary">Use cases:</strong> Log tab Grid/List toggle - the entire UI structure changes
        </div>
      </Subsection>

      {/* Pattern 3: View/Filter Subtabs */}
      <Subsection title="View/Filter Subtabs">
        <p className="text-sm text-text-muted mb-4">
          Use for sorting, filtering, or grouping within a layout. Appears inside the content area, smaller than layout toggles.
        </p>
        <div className="bg-surface-elevated p-4 rounded-lg border border-border-default mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-text-primary font-medium">Loot Log</span>
            <div className="flex bg-surface-base rounded p-0.5">
              <button className="px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold">
                By Floor
              </button>
              <button className="px-2 py-0.5 text-xs rounded text-text-secondary">
                Timeline
              </button>
            </div>
          </div>
          <div className="h-24 bg-surface-base rounded border border-border-subtle flex items-center justify-center text-text-muted">
            Same list, different grouping/sorting
          </div>
        </div>
        <div className="text-sm text-text-muted">
          <strong className="text-text-primary">Use cases:</strong> Log List view (By Floor vs Timeline) - same entries, different organization
        </div>
      </Subsection>

      {/* Pattern 4: Context-Appropriate Sizing */}
      <Subsection title="Context-Appropriate Sizing">
        <p className="text-sm text-text-muted mb-4">
          Element sizes should reflect their importance. Primary interaction areas get prominence, summaries stay compact.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-surface-elevated p-4 rounded-lg border border-border-default">
            <div className="text-sm text-text-primary font-medium mb-2">Grid View (Primary)</div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {['T1', 'T2', 'H1', 'H2'].map(pos => (
                <div key={pos} className="bg-surface-base rounded p-2 text-center">
                  <div className="text-lg font-bold text-accent">{pos}</div>
                  <div className="text-xs text-text-muted">Name</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-text-muted">Large player badges - this is the primary editing interface</div>
          </div>
          <div className="bg-surface-elevated p-4 rounded-lg border border-border-default">
            <div className="text-sm text-text-primary font-medium mb-2">List Header (Summary)</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-text-muted">Week 1 Drops:</span>
              {['T1', 'H1', 'M1', 'R1'].map(pos => (
                <span key={pos} className="px-1.5 py-0.5 text-xs bg-surface-base rounded text-text-secondary">
                  {pos}
                </span>
              ))}
            </div>
            <div className="text-xs text-text-muted">Tiny badges - just a summary, not for editing</div>
          </div>
        </div>
      </Subsection>
    </Section>
  );
}

// Container System Section
function ContainersSection() {
  return (
    <Section id="containers" title="Container System">
      <p className="text-text-secondary mb-6">
        A 5-tier container system for consistent width constraints across page types.
        Prevents content from stretching infinitely on ultrawide monitors (3440px+).
      </p>

      {/* Container Tiers */}
      <Subsection title="Container Tiers">
        <p className="text-sm text-text-muted mb-4">
          Each tier serves a specific purpose. Use the PageContainer component or apply classes directly.
        </p>
        <div className="space-y-3">
          {[
            { name: 'data', width: '160rem (2560px)', desc: 'Data-dense grids, player cards', example: 'GroupView' },
            { name: 'wide', width: '120rem (1920px)', desc: 'Documentation with sidebar', example: 'API Docs, Guides' },
            { name: 'focus', width: '80rem (1280px)', desc: 'Focused content, simple docs', example: 'Release Notes' },
            { name: 'narrow', width: 'max-w-6xl (1152px)', desc: 'Card grids, dashboards', example: 'Dashboard' },
            { name: 'compact', width: 'max-w-4xl (896px)', desc: 'Marketing, landing pages', example: 'Home page' },
          ].map(tier => (
            <div key={tier.name} className="flex items-center gap-4 p-3 bg-surface-elevated rounded-lg border border-border-default">
              <code className="px-2 py-1 bg-accent/10 text-accent rounded text-sm font-mono min-w-[80px]">
                {tier.name}
              </code>
              <div className="flex-1">
                <div className="text-text-primary text-sm font-medium">{tier.width}</div>
                <div className="text-text-muted text-xs">{tier.desc}</div>
              </div>
              <div className="text-text-secondary text-xs">{tier.example}</div>
            </div>
          ))}
        </div>
      </Subsection>

      {/* Usage */}
      <Subsection title="Usage">
        <p className="text-sm text-text-muted mb-4">
          Import PageContainer from layout or use Tailwind classes directly.
        </p>
        <CodeBlock
          language="tsx"
          code={`// Using PageContainer component
import { PageContainer } from '../components/layout';

<PageContainer variant="data">
  <PlayerGrid />
</PageContainer>

// Or use Tailwind classes directly
<div className="max-w-[160rem] mx-auto">
  <PlayerGrid />
</div>`}
        />
      </Subsection>

      {/* Grid Breakpoints */}
      <Subsection title="Grid Breakpoints">
        <p className="text-sm text-text-muted mb-4">
          Custom grid breakpoints for ultrawide scaling. Player grids scale from 1-6 columns.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { breakpoint: 'sm (640px)', cols: '2 columns' },
            { breakpoint: 'lg (1024px)', cols: '3 columns' },
            { breakpoint: 'grid-4xl (1400px)', cols: '4 columns' },
            { breakpoint: 'grid-5xl (1600px)', cols: '5 columns' },
            { breakpoint: 'grid-6xl (2000px)', cols: '6 columns' },
          ].map(bp => (
            <div key={bp.breakpoint} className="p-3 bg-surface-elevated rounded border border-border-default">
              <div className="text-xs text-text-muted">{bp.breakpoint}</div>
              <div className="text-sm text-text-primary font-medium">{bp.cols}</div>
            </div>
          ))}
        </div>
      </Subsection>
    </Section>
  );
}

// Sidebar Navigation Component
function NavSidebar({
  activeSection,
  onSectionClick
}: {
  activeSection: string;
  onSectionClick: (id: string) => void;
}) {
  // Track collapsed state for groups (Colors starts collapsed due to length)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Track scroll position for fade indicators
  const [scrollState, setScrollState] = useState({ top: true, bottom: false });
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = node;
        setScrollState({
          top: scrollTop < 10,
          bottom: scrollTop + clientHeight >= scrollHeight - 10,
        });
      };
      node.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
    }
  }, []);

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handleClick = (id: string) => {
    // Set active immediately for responsive feedback
    onSectionClick(id);
    // Then scroll to section
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-16 w-56 shrink-0 hidden lg:block self-start h-fit z-30">
      <div className="relative bg-surface-card border border-border-subtle rounded-lg">
        {/* Top fade indicator */}
        <div
          className={`
            absolute top-0 left-0 right-0 h-6 rounded-t-lg pointer-events-none z-10
            bg-gradient-to-b from-surface-card to-transparent
            transition-opacity duration-150
            ${scrollState.top ? 'opacity-0' : 'opacity-100'}
          `}
        />

        {/* Scrollable content */}
        <div
          ref={scrollContainerRef}
          className="p-3 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin"
        >
          {NAV_GROUPS.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.label);
            const itemCount = group.items.length;

            return (
              <div key={group.label} className={groupIndex > 0 ? 'mt-3' : ''}>
                {/* Group header - all groups are collapsible for consistency */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="
                    w-full flex items-center justify-between
                    text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em]
                    mb-1 px-1 py-0.5 rounded
                    hover:text-text-muted hover:bg-surface-interactive cursor-pointer
                  "
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-[9px] font-normal tracking-normal opacity-60">
                      {itemCount}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </span>
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <ul className="space-y-px">
                    {group.items.map((section) => (
                      <li key={section.id}>
                        <button
                          onClick={() => handleClick(section.id)}
                          className={`
                            w-full text-left pl-3 pr-2 py-1.5 text-[13px] rounded transition-colors
                            ${activeSection === section.id
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
                            }
                          `}
                        >
                          {section.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Collapsed preview */}
                {isCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full text-left pl-3 pr-2 py-1.5 text-[12px] text-text-muted hover:text-text-secondary rounded hover:bg-surface-interactive transition-colors"
                  >
                    {itemCount} items...
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom fade indicator */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-6 rounded-b-lg pointer-events-none z-10
            bg-gradient-to-t from-surface-card to-transparent
            transition-opacity duration-150
            ${scrollState.bottom ? 'opacity-0' : 'opacity-100'}
          `}
        />
      </div>
    </nav>
  );
}

export function DesignSystem() {
  const location = useLocation();
  const navigate = useNavigate();
  // Initialize from URL hash if present
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) return hash.slice(1);
    return 'design-principles';
  });
  // Track programmatic scroll to prevent scroll handler from overwriting clicked section
  const isScrollingRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);

  // Handle URL hash anchor scrolling on mount/change
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1); // Remove #
      const element = document.getElementById(id);
      if (element) {
        // State is already set via initializer or handleNavClick
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.hash]);

  // Handle nav item click - locks scroll tracking until scroll animation completes
  const handleNavClick = useCallback((sectionId: string) => {
    // Set active immediately
    setActiveSection(sectionId);
    // Lock scroll tracking during programmatic scroll
    isScrollingRef.current = true;
    // Update URL hash
    navigate(`#${sectionId}`, { replace: true });
  }, [navigate]);

  // Track active section on scroll - finds section most visible in viewport
  useEffect(() => {
    const handleScroll = () => {
      // During programmatic scroll, detect when scrolling stops (no events for 150ms)
      if (isScrollingRef.current) {
        if (scrollEndTimeoutRef.current) {
          clearTimeout(scrollEndTimeoutRef.current);
        }
        scrollEndTimeoutRef.current = window.setTimeout(() => {
          isScrollingRef.current = false;
        }, 150);
        return; // Don't update active section during programmatic scroll
      }

      // "Most recently scrolled past" algorithm:
      // Active section = the section whose heading you most recently scrolled past
      // This is predictable regardless of scroll direction

      const threshold = 120; // Heading must be at or above this point to count as "scrolled past"
      const viewportHeight = window.innerHeight;

      const sections = NAV_SECTIONS.map(s => ({
        id: s.id,
        element: document.getElementById(s.id)
      })).filter(s => s.element);

      // Check if at bottom of page - select last section
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - viewportHeight;
      const scrollRemaining = maxScroll - scrollTop;

      // If less than 100px of scroll remaining, we're at the bottom
      if (scrollRemaining < 100 && sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        setActiveSection(prev => {
          if (prev !== lastSection.id) {
            window.history.replaceState(null, '', `#${lastSection.id}`);
          }
          return lastSection.id;
        });
        return;
      }

      // Find sections whose heading has been scrolled past (top <= threshold)
      // Among those, pick the one with the highest top (most recently crossed)
      let bestSection: string | null = null;
      let bestTop = -Infinity;

      for (const section of sections) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();

          // Section heading has been scrolled past if its top is at or above threshold
          if (rect.top <= threshold && rect.top > bestTop) {
            bestTop = rect.top;
            bestSection = section.id;
          }
        }
      }

      // Fallback: if no section has been scrolled past, pick the first visible one
      if (!bestSection) {
        for (const section of sections) {
          if (section.element) {
            const rect = section.element.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < viewportHeight) {
              bestSection = section.id;
              break;
            }
          }
        }
      }

      // Final fallback: first section
      if (!bestSection) {
        bestSection = sections[0]?.id || 'design-principles';
      }

      setActiveSection(prev => {
        if (prev !== bestSection) {
          // Update URL hash when active section changes from scroll
          window.history.replaceState(null, '', `#${bestSection}`);
        }
        return bestSection;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Cleanup timeout on unmount
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <a href="/docs" className="hover:text-accent transition-colors">Documentation</a>
            <span>/</span>
            <span className="text-text-secondary">Design System</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Palette className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-accent">Design System</h1>
              <p className="text-text-secondary mt-1">
                FFXIV Raid Planner visual reference guide - v2.7.0
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content with Sidebar - wider max-width for better ultrawide support */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Introduction */}
          <Section id="design-principles" title="Design Principles">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Data First',
                description: 'Interface serves the data. Minimal chrome, maximum information.',
              },
              {
                title: 'Quiet Confidence',
                description: 'Dark foundation with strategic accent colors. No unnecessary noise.',
              },
              {
                title: 'Clear Hierarchy',
                description: 'Surface elevation creates depth. Important elements stand out naturally.',
              },
              {
                title: 'Consistent Language',
                description: 'Same color = same meaning. Predictable visual vocabulary.',
              },
            ].map((principle) => (
              <div
                key={principle.title}
                className="bg-surface-card border border-border-subtle rounded-lg p-4"
              >
                <h4 className="font-medium text-text-primary mb-2">{principle.title}</h4>
                <p className="text-sm text-text-secondary">{principle.description}</p>
              </div>
            ))}
          </div>
        </Section>

          {/* Surface Hierarchy */}
          <Section id="surface-hierarchy" title="Surface Hierarchy">
          <p className="text-text-secondary mb-6">
            Six levels of surface colors create depth and visual hierarchy.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Base', token: '--color-surface-base', hex: '#050508', level: 0 },
              { name: 'Raised', token: '--color-surface-raised', hex: '#0a0a0f', level: 1 },
              { name: 'Card', token: '--color-surface-card', hex: '#0e0e14', level: 2 },
              { name: 'Elevated', token: '--color-surface-elevated', hex: '#121218', level: 3 },
              { name: 'Overlay', token: '--color-surface-overlay', hex: '#18181f', level: 4 },
              { name: 'Interactive', token: '--color-surface-interactive', hex: '#1e1e26', level: 5 },
            ].map((surface) => (
              <div key={surface.name} className="text-center">
                <div
                  className="w-full aspect-square rounded-lg border border-border-default mb-2"
                  style={{ backgroundColor: surface.hex }}
                />
                <div className="font-medium text-text-primary text-sm">{surface.name}</div>
                <div className="text-xs text-text-muted">Level {surface.level}</div>
              </div>
            ))}
          </div>
        </Section>

          {/* Accent Colors */}
          <Section id="accent-colors" title="Accent Colors">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ColorSwatch name="Accent" token="--color-accent" hex="#14b8a6" description="Primary CTAs, links" />
            <ColorSwatch name="Accent Hover" token="--color-accent-hover" hex="#2dd4bf" description="Hover state" />
            <ColorSwatch name="Accent Muted" token="--color-accent-muted" hex="#0d7377" description="Subdued variant" />
            <ColorSwatch name="Accent Deep" token="--color-accent-deep" hex="#0891b2" description="Gradient end" />
          </div>
        </Section>

          {/* Role Colors */}
          <Section id="role-colors" title="Role Colors (FFXIV Standard)">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'Tank', token: '--color-role-tank', hex: '#5a9fd4', jobs: 'DRK, PLD, WAR, GNB' },
              { name: 'Healer', token: '--color-role-healer', hex: '#5ad490', jobs: 'WHM, SCH, AST, SGE' },
              { name: 'Melee', token: '--color-role-melee', hex: '#d45a5a', jobs: 'MNK, DRG, NIN, SAM, RPR, VPR' },
              { name: 'Ranged', token: '--color-role-ranged', hex: '#d4a05a', jobs: 'BRD, MCH, DNC' },
              { name: 'Caster', token: '--color-role-caster', hex: '#b45ad4', jobs: 'BLM, SMN, RDM, PCT' },
            ].map((role) => (
              <div key={role.name} className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div
                  className="w-10 h-10 rounded-full mb-3"
                  style={{ backgroundColor: role.hex }}
                />
                <div className="font-medium text-text-primary">{role.name}</div>
                <div className="text-xs text-text-muted font-mono">{role.hex}</div>
                <div className="text-xs text-text-secondary mt-1">{role.jobs}</div>
              </div>
            ))}
          </div>
        </Section>

          {/* Floor Colors */}
          <Section id="floor-colors" title="Floor Colors">
          <p className="text-text-secondary mb-6">
            Each raid floor has a distinct color for quick identification.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { floor: 1, name: 'Floor 1', token: '--color-floor-1', hex: '#22c55e', content: 'Accessories (M9S)' },
              { floor: 2, name: 'Floor 2', token: '--color-floor-2', hex: '#3b82f6', content: 'Left Side (M10S)' },
              { floor: 3, name: 'Floor 3', token: '--color-floor-3', hex: '#a855f7', content: 'Body (M11S)' },
              { floor: 4, name: 'Floor 4', token: '--color-floor-4', hex: '#f59e0b', content: 'Weapon (M12S)' },
            ].map((floor) => (
              <div
                key={floor.floor}
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: `${floor.hex}20`,
                  borderColor: `${floor.hex}40`,
                }}
              >
                <div className="font-bold text-lg" style={{ color: floor.hex }}>
                  {floor.name}
                </div>
                <div className="text-sm text-text-secondary">{floor.content}</div>
                <div className="text-xs font-mono mt-2" style={{ color: floor.hex }}>
                  {floor.hex}
                </div>
              </div>
            ))}
          </div>
        </Section>

          {/* Progression Colors */}
          <Section id="progression-colors" title="Progression Colors">
          <p className="text-text-secondary mb-6">
            BiS completion state indicators inspired by the Arcadion spreadsheet.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'Complete', token: '--color-progress-complete', hex: '#a78bfa', range: '100%' },
              { name: 'Near', token: '--color-progress-near', hex: '#60a5fa', range: '80-99%' },
              { name: 'Good', token: '--color-progress-good', hex: '#4ade80', range: '50-79%' },
              { name: 'Needs', token: '--color-progress-needs', hex: '#facc15', range: '20-49%' },
              { name: 'Priority', token: '--color-progress-priority', hex: '#f87171', range: '<20%' },
            ].map((progress) => (
              <div
                key={progress.name}
                className="rounded-lg p-4 border text-center"
                style={{
                  backgroundColor: `${progress.hex}15`,
                  borderColor: `${progress.hex}40`,
                }}
              >
                <div className="font-semibold" style={{ color: progress.hex }}>
                  {progress.name}
                </div>
                <div className="text-xs text-text-muted">{progress.range}</div>
              </div>
            ))}
          </div>
        </Section>

          {/* Membership Colors */}
          <Section id="membership-colors" title="Membership Role Colors">
          <p className="text-text-secondary mb-6">
            User role within static groups. Use semantic tokens for consistent styling.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { name: 'Owner', token: 'membership-owner', hex: '#14b8a6', access: 'Full control', tailwind: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30' },
              { name: 'Lead', token: 'membership-lead', hex: '#a855f7', access: 'Manage tiers/players', tailwind: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30' },
              { name: 'Member', token: 'membership-member', hex: '#3b82f6', access: 'Edit claimed players', tailwind: 'bg-membership-member/20 text-membership-member border-membership-member/30' },
              { name: 'Viewer', token: 'membership-viewer', hex: '#71717a', access: 'Read-only', tailwind: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30' },
              { name: 'Linked', token: 'membership-linked', hex: '#f59e0b', access: 'Player-linked access', tailwind: 'bg-membership-linked/20 text-membership-linked border-membership-linked/30' },
            ].map((role) => (
              <div key={role.name} className="space-y-2">
                <div
                  className="px-3 py-1.5 rounded border text-sm font-medium text-center"
                  style={{
                    backgroundColor: `${role.hex}20`,
                    borderColor: `${role.hex}40`,
                    color: role.hex,
                  }}
                >
                  {role.name}
                </div>
                <div className="text-xs text-text-muted text-center">{role.access}</div>
                <code className="block text-[10px] text-accent bg-surface-elevated px-2 py-1 rounded text-center truncate" title={role.tailwind}>
                  {role.token}
                </code>
              </div>
            ))}
          </div>
        </Section>

          {/* Gear Source Colors */}
          <Section id="gear-source-colors" title="Gear Source Colors">
          <p className="text-text-secondary mb-6">
            Equipment origin tracking badges.
          </p>
          <div className="flex flex-wrap gap-2">
            {(['savage', 'tome_up', 'tome', 'crafted'] as GearSourceCategory[]).map(
              (source) => (
                <GearSourceBadge key={source} source={source} />
              )
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(['savage', 'tome_up', 'tome', 'crafted'] as GearSourceCategory[]).map(
              (source) => (
                <GearSourceBadge key={source} source={source} compact />
              )
            )}
          </div>
        </Section>

          {/* Status Colors */}
          <Section id="status-colors" title="Status Colors">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Success', token: '--color-status-success', hex: '#22c55e' },
              { name: 'Warning', token: '--color-status-warning', hex: '#eab308' },
              { name: 'Error', token: '--color-status-error', hex: '#ef4444' },
              { name: 'Info', token: '--color-status-info', hex: '#3b82f6' },
            ].map((status) => (
              <ColorSwatch key={status.name} {...status} />
            ))}
          </div>
        </Section>

          {/* Material Colors */}
          <Section id="material-colors" title="Material Colors">
            <p className="text-text-secondary mb-6">
              Upgrade material colors matching FFXIV game materials for consistent visual identification.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Twine', token: '--color-material-twine', hex: '#3b82f6', description: 'Armor upgrade' },
                { name: 'Glaze', token: '--color-material-glaze', hex: '#a855f7', description: 'Accessory upgrade' },
                { name: 'Solvent', token: '--color-material-solvent', hex: '#eab308', description: 'Weapon upgrade' },
                { name: 'Tomestone', token: '--color-material-tomestone', hex: '#f97316', description: 'Universal' },
              ].map((material) => (
                <div key={material.name} className="bg-surface-card rounded-lg border border-border-subtle p-4">
                  <div
                    className="w-full h-12 rounded-lg mb-3"
                    style={{ backgroundColor: material.hex }}
                  />
                  <div className="text-sm font-medium text-text-primary">{material.name}</div>
                  <div className="text-xs text-text-muted font-mono">{material.hex}</div>
                  <div className="text-xs text-text-secondary mt-1">{material.description}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-surface-elevated rounded-lg">
              <h4 className="text-sm font-medium text-text-primary mb-2">Usage</h4>
              <code className="text-xs text-accent">
                text-material-twine, text-material-glaze, text-material-solvent
              </code>
            </div>
          </Section>

          {/* Text Colors */}
          <Section id="text-colors" title="Text Colors">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-text-primary text-lg">Primary Text</span>
              <span className="text-xs font-mono text-text-muted">#f0f0f5 (15.2:1)</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-text-secondary text-lg">Secondary Text</span>
              <span className="text-xs font-mono text-text-muted">#a1a1aa (6.1:1)</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-text-muted text-lg">Muted Text</span>
              <span className="text-xs font-mono text-text-muted">#71717a (4.5:1)</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-text-disabled text-lg">Disabled Text</span>
              <span className="text-xs font-mono text-text-muted">#52525b (decorative)</span>
            </div>
          </div>
        </Section>

          {/* Typography */}
          <Section id="typography" title="Typography">
          <Subsection title="Type Scale">
            <div className="space-y-4 bg-surface-card p-6 rounded-lg border border-border-subtle">
              <div className="text-3xl font-bold text-text-primary">Hero Text (30px)</div>
              <div className="text-2xl font-semibold text-text-primary">Page Title (24px)</div>
              <div className="text-xl font-medium text-text-primary">Section Header (20px)</div>
              <div className="text-lg text-text-primary">Large Text (18px)</div>
              <div className="text-base text-text-primary">Body Default (16px)</div>
              <div className="text-sm text-text-secondary">Body Small / Labels (14px)</div>
              <div className="text-xs text-text-muted">Captions / Badges (12px)</div>
            </div>
          </Subsection>

          <Subsection title="Font Weights">
            <div className="space-y-2">
              <div style={{ fontWeight: 400 }} className="text-text-primary">Normal (400) - Body text</div>
              <div style={{ fontWeight: 500 }} className="text-text-primary">Medium (500) - Labels, emphasis</div>
              <div style={{ fontWeight: 600 }} className="text-text-primary">Semibold (600) - Buttons, headings</div>
              <div style={{ fontWeight: 700 }} className="text-text-primary">Bold (700) - Strong emphasis</div>
              <div style={{ fontWeight: 800 }} className="text-text-primary">Extrabold (800) - Extra emphasis</div>
              <div style={{ fontWeight: 900 }} className="text-text-primary">Black (900) - Maximum weight</div>
            </div>
            <p className="text-xs text-text-muted mt-4">
              Using inline styles to test font weight loading. If these all look the same,
              the Inter font weights aren't loading correctly.
            </p>
          </Subsection>
        </Section>

          {/* Spacing */}
          <Section id="spacing" title="Spacing Scale">
          <p className="text-text-secondary mb-6">4px grid system for consistent spacing.</p>
          <div className="space-y-4">
            {[
              { name: 'space-1', value: '4px', rem: '0.25rem' },
              { name: 'space-2', value: '8px', rem: '0.5rem' },
              { name: 'space-3', value: '12px', rem: '0.75rem' },
              { name: 'space-4', value: '16px', rem: '1rem' },
              { name: 'space-6', value: '24px', rem: '1.5rem' },
              { name: 'space-8', value: '32px', rem: '2rem' },
              { name: 'space-12', value: '48px', rem: '3rem' },
            ].map((space) => (
              <div key={space.name} className="flex items-center gap-4">
                <div
                  className="bg-accent/30 rounded"
                  style={{ width: space.value, height: '24px' }}
                />
                <span className="text-sm font-mono text-text-primary w-24">{space.name}</span>
                <span className="text-sm text-text-secondary">{space.value}</span>
              </div>
            ))}
          </div>
        </Section>

          {/* Buttons */}
          <Section id="buttons" title="Buttons">
          <Subsection title="Button Variants">
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </Subsection>

          <Subsection title="Button Sizes">
            <div className="flex flex-wrap gap-4 items-center">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </Subsection>

          <Subsection title="Button States">
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="primary">Normal</Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <Button variant="primary" loading>
                Loading
              </Button>
            </div>
          </Subsection>
        </Section>

          {/* Badges */}
          <Section id="badges" title="Badges">
          <Subsection title="Default Badges">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="raid">Raid</Badge>
              <Badge variant="tome">Tome</Badge>
              <Badge variant="augmented">Augmented</Badge>
              <Badge variant="crafted">Crafted</Badge>
            </div>
          </Subsection>

          <Subsection title="Status Badges">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="info">Info</Badge>
            </div>
          </Subsection>

          <Subsection title="Role Badges">
            <div className="flex flex-wrap gap-2">
              <Badge variant="tank">Tank</Badge>
              <Badge variant="healer">Healer</Badge>
              <Badge variant="melee">Melee</Badge>
              <Badge variant="ranged">Ranged</Badge>
              <Badge variant="caster">Caster</Badge>
            </div>
          </Subsection>
        </Section>

          {/* Icon Buttons */}
          <Section id="icon-buttons" title="Icon Buttons">
          <Subsection title="With Lucide Icons">
            <div className="flex flex-wrap gap-4 items-center">
              <IconButton icon={<Settings className="w-4 h-4" />} aria-label="Settings" />
              <IconButton icon={<Pencil className="w-4 h-4" />} aria-label="Edit" />
              <IconButton icon={<Trash2 className="w-4 h-4" />} aria-label="Delete" variant="danger" />
              <IconButton icon={<Plus className="w-4 h-4" />} aria-label="Add" variant="ghost" />
              <IconButton icon={<Copy className="w-4 h-4" />} aria-label="Copy" />
              <IconButton icon={<RefreshCw className="w-4 h-4" />} aria-label="Refresh" variant="ghost" />
            </div>
          </Subsection>

          <Subsection title="Sizes">
            <div className="flex flex-wrap gap-4 items-center">
              <IconButton icon={<Settings className="w-3 h-3" />} aria-label="Small" size="sm" />
              <IconButton icon={<Settings className="w-4 h-4" />} aria-label="Medium" size="md" />
              <IconButton icon={<Settings className="w-5 h-5" />} aria-label="Large" size="lg" />
            </div>
          </Subsection>
        </Section>

        {/* Icon Library */}
        <IconLibrarySection />

        {/* Job Icons */}
        <Section id="job-icons" title="Job Icons">
          <Subsection title="Icon Sizes">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="text-center">
                <JobIcon job="DRK" size="xs" />
                <div className="text-xs text-text-muted mt-1">xs</div>
              </div>
              <div className="text-center">
                <JobIcon job="DRK" size="sm" />
                <div className="text-xs text-text-muted mt-1">sm</div>
              </div>
              <div className="text-center">
                <JobIcon job="DRK" size="md" />
                <div className="text-xs text-text-muted mt-1">md</div>
              </div>
              <div className="text-center">
                <JobIcon job="DRK" size="lg" />
                <div className="text-xs text-text-muted mt-1">lg</div>
              </div>
            </div>
          </Subsection>

          <Subsection title="All Jobs">
            <div className="flex flex-wrap gap-2">
              {['PLD', 'WAR', 'DRK', 'GNB', 'WHM', 'SCH', 'AST', 'SGE', 'MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR', 'BRD', 'MCH', 'DNC', 'BLM', 'SMN', 'RDM', 'PCT'].map(
                (job) => (
                  <Tooltip key={job} content={job}>
                    <div>
                      <JobIcon job={job} size="md" />
                    </div>
                  </Tooltip>
                )
              )}
            </div>
          </Subsection>
        </Section>

        {/* Tooltips */}
        <Section id="tooltips" title="Tooltips">
          <div className="flex flex-col gap-3 items-start">
            <Tooltip content="Top tooltip" side="top">
              <button className="px-4 py-2 bg-surface-card border border-border-default rounded hover:border-accent/30">
                Hover (Top)
              </button>
            </Tooltip>
            <Tooltip content="Left tooltip" side="left">
              <button className="px-4 py-2 bg-surface-card border border-border-default rounded hover:border-accent/30">
                Hover (Left)
              </button>
            </Tooltip>
            <Tooltip content="Right tooltip" side="right">
              <button className="px-4 py-2 bg-surface-card border border-border-default rounded hover:border-accent/30">
                Hover (Right)
              </button>
            </Tooltip>
            <Tooltip content="Bottom tooltip" side="bottom">
              <button className="px-4 py-2 bg-surface-card border border-border-default rounded hover:border-accent/30">
                Hover (Bottom)
              </button>
            </Tooltip>
          </div>
        </Section>

        {/* Popover */}
        <PopoverSection />

        {/* Forms & Inputs */}
        <FormsSection />

        {/* Menus & Navigation */}
        <MenusSection />

        {/* Tab Patterns */}
        <TabPatternsSection />

        {/* Container System */}
        <ContainersSection />

        {/* Page Layout */}
        <Section id="page-layout" title="Page Layout">
          <p className="text-text-secondary mb-6">
            Content-type driven layout architecture. Different content requires different layouts -
            data-heavy pages maximize space, documentation uses contained sidebars.
          </p>

          {/* Core Philosophy */}
          <Subsection title="Why Content-Type Driven Layout?">
            <div className="bg-surface-card border border-accent/30 rounded-lg p-5 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-text-primary font-medium mb-2">The Problem We Solved</p>
                  <p className="text-sm text-text-secondary">
                    The FFXIV Raid Planner displays 8 player cards with 50+ interactive elements each.
                    Navigation-first layouts (persistent sidebars) steal horizontal space that data needs.
                    We identified this as the "floating element anti-pattern" - cascading indentation
                    where each UI region floats on identical backgrounds with no visual containment.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-status-success/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-status-success" />
                  </div>
                  <span className="font-medium text-text-primary">Data-First Pages</span>
                </div>
                <p className="text-sm text-text-secondary mb-3">
                  <strong>GroupView, Dashboard:</strong> No sidebar. Full-width responsive grid.
                  Header contains static switcher + tabs. Contextual toolbar below.
                </p>
                <div className="text-xs text-text-muted">
                  <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">max-w-[160rem]</code> - Expands to 6 columns on ultrawide
                </div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-accent" />
                  </div>
                  <span className="font-medium text-text-primary">Documentation Pages</span>
                </div>
                <p className="text-sm text-text-secondary mb-3">
                  <strong>Design System, Guides:</strong> Sidebar IS appropriate. Text benefits from
                  persistent navigation. Contained in visible boundary.
                </p>
                <div className="text-xs text-text-muted">
                  <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">max-w-[120rem]</code> - Readable width with sidebar
                </div>
              </div>
            </div>
          </Subsection>

          {/* Visual Containment */}
          <Subsection title="Visual Containment Strategy">
            <p className="text-sm text-text-muted mb-4">
              Elements should exist in defined regions, not float on identical backgrounds.
              Use surface hierarchy and borders to create intentional zones.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Anti-pattern */}
              <div className="bg-surface-card border border-status-error/30 rounded-lg overflow-hidden">
                <div className="bg-status-error/10 px-4 py-2 border-b border-status-error/20">
                  <span className="text-sm font-medium text-status-error flex items-center gap-2">
                    <X className="w-4 h-4" /> Anti-Pattern: Floating Elements
                  </span>
                </div>
                <div className="p-4">
                  <div className="bg-surface-base rounded-lg overflow-hidden text-xs">
                    <div className="bg-surface-raised px-3 py-2 text-text-muted">Header (full width)</div>
                    <div className="p-3">
                      <div className="ml-8 bg-surface-raised px-3 py-2 text-text-muted rounded mb-2">Page Header (indented)</div>
                      <div className="ml-16 flex gap-2">
                        <div className="w-16 bg-surface-raised px-2 py-6 text-text-muted rounded text-center">Sidebar</div>
                        <div className="flex-1 bg-surface-raised px-2 py-6 text-text-muted rounded text-center">Content (double indented)</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-3">
                    Cascading indentation creates visual confusion. Each region floats with no clear boundaries.
                  </p>
                </div>
              </div>
              {/* Correct pattern */}
              <div className="bg-surface-card border border-status-success/30 rounded-lg overflow-hidden">
                <div className="bg-status-success/10 px-4 py-2 border-b border-status-success/20">
                  <span className="text-sm font-medium text-status-success flex items-center gap-2">
                    <Check className="w-4 h-4" /> Correct: Defined Regions
                  </span>
                </div>
                <div className="p-4">
                  <div className="bg-[#020203] rounded-lg overflow-hidden text-xs">
                    <div className="bg-surface-raised px-3 py-2 text-text-muted border-b border-border-default">
                      Header (static switcher + tabs + user)
                    </div>
                    <div className="bg-surface-card px-3 py-1.5 text-text-muted border-b border-border-subtle text-[10px]">
                      Toolbar (floor selector, view mode)
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface-card border border-border-subtle px-2 py-4 text-text-muted rounded text-center">Card</div>
                        <div className="bg-surface-card border border-border-subtle px-2 py-4 text-text-muted rounded text-center">Card</div>
                        <div className="bg-surface-card border border-border-subtle px-2 py-4 text-text-muted rounded text-center">Card</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-3">
                    Darker outer background frames content. Clear header → toolbar → content hierarchy.
                  </p>
                </div>
              </div>
            </div>
          </Subsection>

          {/* Layout Types */}
          <Subsection title="Layout Type Reference">
            <p className="text-sm text-text-muted mb-4">
              Choose the appropriate layout based on your content type. Each has specific structural patterns.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-3 text-text-muted font-medium">Page Type</th>
                    <th className="text-left py-3 text-text-muted font-medium">Sidebar</th>
                    <th className="text-left py-3 text-text-muted font-medium">Max Width</th>
                    <th className="text-left py-3 text-text-muted font-medium">Header Pattern</th>
                    <th className="text-left py-3 text-text-muted font-medium">Examples</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  <tr className="border-b border-border-subtle">
                    <td className="py-3 font-medium text-text-primary">Data Grid</td>
                    <td className="py-3"><span className="text-status-error">None</span></td>
                    <td className="py-3"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">160rem</code></td>
                    <td className="py-3">Static switcher + tabs + toolbar</td>
                    <td className="py-3">GroupView, Dashboard</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-3 font-medium text-text-primary">Documentation</td>
                    <td className="py-3"><span className="text-status-success">Sticky nav</span></td>
                    <td className="py-3"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">120rem</code></td>
                    <td className="py-3">Breadcrumb + title</td>
                    <td className="py-3">Design System, Guides</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-3 font-medium text-text-primary">Form/Settings</td>
                    <td className="py-3"><span className="text-status-error">None</span></td>
                    <td className="py-3"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">max-w-2xl</code></td>
                    <td className="py-3">Centered with title</td>
                    <td className="py-3">Create Static, Settings</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-3 font-medium text-text-primary">Landing</td>
                    <td className="py-3"><span className="text-status-error">None</span></td>
                    <td className="py-3"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">80rem</code></td>
                    <td className="py-3">Marketing hero + CTA</td>
                    <td className="py-3">Home, Docs Index</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-text-primary">Modal</td>
                    <td className="py-3"><span className="text-text-muted">N/A</span></td>
                    <td className="py-3"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">md - 4xl</code></td>
                    <td className="py-3">Dialog title + close</td>
                    <td className="py-3">BiS Import, Settings</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Subsection>

          {/* Data-First Layout Anatomy */}
          <Subsection title="Data-First Layout Anatomy">
            <p className="text-sm text-text-muted mb-4">
              Three-zone structure: unified header, contextual toolbar, full-width content grid.
            </p>
            <div className="bg-[#020203] border border-border-default rounded-lg overflow-hidden max-w-4xl">
              {/* Header Zone */}
              <div className="bg-surface-raised border-b border-border-default px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-deep" />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-elevated border border-border-default rounded-lg">
                    <span className="text-sm text-accent font-medium">Static Name</span>
                    <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded">M9S-M12S</span>
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-surface-elevated rounded-lg p-1">
                  <span className="px-4 py-1.5 bg-accent text-accent-contrast text-sm font-medium rounded">Players</span>
                  <span className="px-4 py-1.5 text-sm text-text-secondary">Loot</span>
                  <span className="px-4 py-1.5 text-sm text-text-secondary">History</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-elevated border-2 border-accent/50" />
              </div>
              {/* Toolbar Zone */}
              <div className="bg-surface-card border-b border-border-subtle px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {['All', 'M9S', 'M10S', 'M11S', 'M12S'].map((floor, i) => (
                    <span key={floor} className={`px-3 py-1 text-xs rounded ${i === 0 ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface-elevated text-text-muted border border-border-subtle'}`}>{floor}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">Standard Sort</span>
                  <div className="flex bg-surface-elevated rounded border border-border-default">
                    <span className="px-2 py-1 text-xs text-accent bg-accent/10">Grid</span>
                    <span className="px-2 py-1 text-xs text-text-muted">List</span>
                  </div>
                </div>
              </div>
              {/* Content Zone */}
              <div className="p-6">
                <div className="grid grid-cols-4 gap-4">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="bg-surface-card border border-border-subtle rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1 h-8 rounded ${i <= 2 ? 'bg-role-tank' : i <= 4 ? 'bg-role-healer' : i <= 6 ? 'bg-role-melee' : 'bg-role-ranged'}`} />
                        <div className="w-8 h-8 bg-surface-elevated rounded text-[10px] text-text-muted flex items-center justify-center">JOB</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-primary truncate">Player {i}</div>
                          <div className="text-[10px] text-text-muted">T{i}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {[1,2,3,4,5].map(j => (
                          <div key={j} className={`aspect-square rounded text-[8px] flex items-center justify-center ${j <= 3 ? 'bg-accent/20 text-accent' : 'bg-surface-elevated text-text-muted'}`}>G</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-elevated rounded-lg p-3">
                <div className="text-xs font-semibold text-accent mb-1">Header Zone</div>
                <p className="text-xs text-text-muted">Logo + static switcher + main tabs + user menu. Consistent across all data pages.</p>
              </div>
              <div className="bg-surface-elevated rounded-lg p-3">
                <div className="text-xs font-semibold text-accent mb-1">Toolbar Zone</div>
                <p className="text-xs text-text-muted">Contextual controls: floor selector, sort mode, view toggle. Changes per tab.</p>
              </div>
              <div className="bg-surface-elevated rounded-lg p-3">
                <div className="text-xs font-semibold text-accent mb-1">Content Zone</div>
                <p className="text-xs text-text-muted">Full-width responsive grid. Darker outer background (#020203) frames content.</p>
              </div>
            </div>
          </Subsection>

          {/* Documentation Layout Anatomy */}
          <Subsection title="Documentation Layout Anatomy">
            <p className="text-sm text-text-muted mb-4">
              Contained layout with sticky sidebar. Appropriate for text-heavy, reference content.
            </p>
            <div className="bg-[#020203] border border-border-default rounded-lg overflow-hidden max-w-4xl">
              {/* Header */}
              <div className="bg-surface-raised border-b border-border-default px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-deep" />
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-muted">Documentation</span>
                    <span className="text-text-muted">/</span>
                    <span className="text-accent">Design System</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-elevated border-2 border-accent/50" />
              </div>
              {/* Body with container */}
              <div className="p-6">
                <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden flex shadow-lg">
                  {/* Sidebar */}
                  <div className="w-48 bg-surface-raised border-r border-border-default p-4 shrink-0">
                    <div className="text-[9px] uppercase tracking-wider text-text-muted/70 mb-2">Foundations</div>
                    <div className="space-y-1 mb-4">
                      <div className="px-3 py-1.5 bg-accent/10 text-accent text-sm rounded">Principles</div>
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-text-muted/70 mb-2">Colors</div>
                    <div className="space-y-1">
                      <div className="px-3 py-1.5 text-text-secondary text-sm">Surfaces</div>
                      <div className="px-3 py-1.5 text-text-secondary text-sm">Accent</div>
                      <div className="px-3 py-1.5 text-text-secondary text-sm">Roles</div>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-6">
                    <h2 className="text-xl font-semibold text-accent mb-2">Design Principles</h2>
                    <p className="text-sm text-text-secondary mb-4">Core philosophy guiding the visual language.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-card border border-border-subtle rounded-lg p-3">
                        <div className="font-medium text-text-primary text-sm mb-1">Data First</div>
                        <div className="text-xs text-text-muted">Interface serves the data.</div>
                      </div>
                      <div className="bg-surface-card border border-border-subtle rounded-lg p-3">
                        <div className="font-medium text-text-primary text-sm mb-1">Quiet Confidence</div>
                        <div className="text-xs text-text-muted">Dark with strategic accent.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-3">
              Note the visible container boundary - sidebar and content exist within a defined region,
              not floating on the page background.
            </p>
          </Subsection>

          {/* Responsive Breakpoints */}
          <Subsection title="Responsive Breakpoints">
            <p className="text-sm text-text-muted mb-4">
              Standard Tailwind breakpoints plus custom ultrawide breakpoints for data-heavy grids.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Breakpoint</th>
                    <th className="text-left py-2 text-text-muted font-medium">Min Width</th>
                    <th className="text-left py-2 text-text-muted font-medium">Grid Cols</th>
                    <th className="text-left py-2 text-text-muted font-medium">Typical Display</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  <tr className="border-b border-border-subtle">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">base</code></td>
                    <td className="py-2">0px</td>
                    <td className="py-2">1</td>
                    <td className="py-2">Mobile portrait</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">sm:</code></td>
                    <td className="py-2">640px</td>
                    <td className="py-2">2</td>
                    <td className="py-2">Mobile landscape, small tablets</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">md:</code></td>
                    <td className="py-2">768px</td>
                    <td className="py-2">2</td>
                    <td className="py-2">Tablets</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">lg:</code></td>
                    <td className="py-2">1024px</td>
                    <td className="py-2">3</td>
                    <td className="py-2">Desktop (show sidebars)</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">xl:</code></td>
                    <td className="py-2">1280px</td>
                    <td className="py-2">3</td>
                    <td className="py-2">Large desktop</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">2xl:</code></td>
                    <td className="py-2">1536px</td>
                    <td className="py-2">4</td>
                    <td className="py-2">Wide desktop</td>
                  </tr>
                  <tr className="border-b border-border-subtle bg-accent/5">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">3xl:</code></td>
                    <td className="py-2">1920px</td>
                    <td className="py-2">5</td>
                    <td className="py-2">Full HD / 1080p monitors</td>
                  </tr>
                  <tr className="border-b border-border-subtle bg-accent/5">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">4xl:</code></td>
                    <td className="py-2">2560px</td>
                    <td className="py-2">6</td>
                    <td className="py-2">QHD / 1440p monitors</td>
                  </tr>
                  <tr className="bg-accent/5">
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">5xl:</code></td>
                    <td className="py-2">3440px</td>
                    <td className="py-2">6+</td>
                    <td className="py-2">Ultrawide monitors</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-surface-elevated rounded-lg">
              <p className="text-xs text-text-muted">
                <strong className="text-text-secondary">Why ultrawide breakpoints?</strong> Standard Tailwind
                stops at 1536px (2xl), but many FFXIV players use ultrawide monitors. Custom 3xl-5xl
                breakpoints enable 5-6 column player grids that utilize available screen space.
              </p>
            </div>
          </Subsection>

          {/* Cross-Platform Considerations */}
          <Subsection title="Cross-Platform Design">
            <p className="text-sm text-text-muted mb-4">
              Same design language, adapted for each platform's interaction patterns and constraints.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <LayoutGrid className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <div className="font-medium text-text-primary text-sm">Desktop / Web</div>
                    <div className="text-[10px] text-accent uppercase tracking-wider">Primary</div>
                  </div>
                </div>
                <ul className="text-xs text-text-secondary space-y-1.5">
                  <li>• Full functionality, deep work sessions</li>
                  <li>• Hover states, keyboard shortcuts</li>
                  <li>• Drag-drop reordering</li>
                  <li>• Multi-column grid layouts</li>
                </ul>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-floor-4/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-floor-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="2" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-text-primary text-sm">Mobile / PWA</div>
                    <div className="text-[10px] text-floor-4 uppercase tracking-wider">Secondary</div>
                  </div>
                </div>
                <ul className="text-xs text-text-secondary space-y-1.5">
                  <li>• Quick reference during raids</li>
                  <li>• Bottom navigation (thumb reach)</li>
                  <li>• Collapsible player cards</li>
                  <li>• FAB for quick loot logging</li>
                </ul>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center">
                    <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
                      <path d="M8 21h8M12 17v4" strokeWidth="2" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-text-primary text-sm">Desktop App</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Future</div>
                  </div>
                </div>
                <ul className="text-xs text-text-secondary space-y-1.5">
                  <li>• Electron/Tauri wrapper</li>
                  <li>• Offline support</li>
                  <li>• System tray notifications</li>
                  <li>• Native drag-drop integration</li>
                </ul>
              </div>
            </div>
          </Subsection>

          {/* Width Constraints Reference */}
          <Subsection title="Width Constraints Reference">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Data Pages</div>
                <code className="text-sm text-accent">max-w-[160rem]</code>
                <p className="text-xs text-text-muted mt-2">2560px - Player grids, dashboards. Expands on ultrawide.</p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Documentation</div>
                <code className="text-sm text-accent">max-w-[120rem]</code>
                <p className="text-xs text-text-muted mt-2">1920px - Text + sidebar. Comfortable reading width.</p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Landing Pages</div>
                <code className="text-sm text-accent">max-w-[80rem]</code>
                <p className="text-xs text-text-muted mt-2">1280px - Marketing, docs index. Focused content.</p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Prose Content</div>
                <code className="text-sm text-accent">max-w-prose / 75ch</code>
                <p className="text-xs text-text-muted mt-2">~600px - Optimal line length for reading.</p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Forms</div>
                <code className="text-sm text-accent">max-w-md to max-w-2xl</code>
                <p className="text-xs text-text-muted mt-2">448px-672px - Centered form layouts.</p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Sidebar</div>
                <code className="text-sm text-accent">w-48 / w-56</code>
                <p className="text-xs text-text-muted mt-2">192px-224px - Navigation sidebars.</p>
              </div>
            </div>
          </Subsection>

          {/* Code Examples */}
          <Subsection title="Implementation Examples">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-accent mb-2">// Data-First Page (GroupView, Dashboard)</div>
                <CodeBlock
                  language="tsx"
                  code={`<div className="min-h-screen bg-[#020203]">
  {/* Header: Static switcher + tabs */}
  <header className="bg-surface-raised border-b border-border-default">
    <div className="px-6 py-3 flex items-center justify-between">
      <StaticSwitcher />
      <TabNavigation tabs={['Players', 'Loot', 'History']} />
      <UserMenu />
    </div>
  </header>

  {/* Toolbar: Contextual controls */}
  <div className="bg-surface-card border-b border-border-subtle px-6 py-2">
    <FloorSelector />
    <ViewModeToggle />
  </div>

  {/* Content: Full-width responsive grid */}
  <main className="max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
                    2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6">
      {players.map(player => <PlayerCard key={player.id} {...player} />)}
    </div>
  </main>
</div>`}
                />
              </div>
              <div>
                <div className="text-xs text-accent mb-2">// Documentation Page (Design System)</div>
                <CodeBlock
                  language="tsx"
                  code={`<div className="min-h-screen bg-surface-base">
  {/* Header: Breadcrumb navigation */}
  <header className="bg-surface-raised border-b border-border-default">
    <div className="max-w-[120rem] mx-auto px-6 py-6">
      <Breadcrumb items={['Documentation', 'Design System']} />
      <h1 className="text-3xl font-bold text-accent">Design System</h1>
    </div>
  </header>

  {/* Content: Sidebar + main in container */}
  <div className="max-w-[120rem] mx-auto px-6 py-8 flex gap-8">
    <nav className="sticky top-6 w-48 shrink-0 hidden lg:block self-start">
      <SidebarNavigation sections={NAV_SECTIONS} />
    </nav>
    <main className="flex-1 min-w-0">
      {/* Section content */}
    </main>
  </div>
</div>`}
                />
              </div>
            </div>
          </Subsection>
        </Section>

        {/* Tables */}
        <Section id="tables" title="Tables">
          <p className="text-text-secondary mb-6">
            Data tables with sortable columns. Clear visual hierarchy distinguishes active sort state from interactive hover states.
          </p>

          <Subsection title="Sortable Column Headers">
            <p className="text-sm text-text-muted mb-4">
              Column headers use distinct visual treatments for active vs inactive states.
              Active columns always display their sort direction; inactive columns show a neutral icon on hover.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Inactive (Default)</div>
                <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
                  <span>Column Name</span>
                  <span className="opacity-0">
                    <ChevronsUpDown className="w-4 h-4" />
                  </span>
                </div>
                <p className="text-xs text-text-muted">Sort icon hidden until hover</p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Inactive (Hover)</div>
                <div className="flex items-center gap-2 text-text-primary text-sm mb-2">
                  <span>Column Name</span>
                  <span className="opacity-50">
                    <ChevronsUpDown className="w-4 h-4" />
                  </span>
                </div>
                <p className="text-xs text-text-muted">Neutral icon at 50% opacity signals sortability</p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Active (Always Visible)</div>
                <div className="flex items-center gap-2 text-text-primary text-sm mb-2">
                  <span>Column Name</span>
                  <span className="text-accent">
                    <ChevronUp className="w-4 h-4" />
                  </span>
                </div>
                <p className="text-xs text-text-muted">Direction icon in accent color, always visible</p>
              </div>
            </div>

            <SortableTableDemo />
          </Subsection>

          <Subsection title="Icon Usage">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 flex items-center gap-3">
                <ChevronUp className="w-5 h-5 text-accent" />
                <div>
                  <div className="font-medium text-text-primary text-sm">ChevronUp</div>
                  <div className="text-xs text-text-muted">Active ascending</div>
                </div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 flex items-center gap-3">
                <ChevronDown className="w-5 h-5 text-accent" />
                <div>
                  <div className="font-medium text-text-primary text-sm">ChevronDown</div>
                  <div className="text-xs text-text-muted">Active descending</div>
                </div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 flex items-center gap-3">
                <ChevronsUpDown className="w-5 h-5 text-text-muted" />
                <div>
                  <div className="font-medium text-text-primary text-sm">ChevronsUpDown</div>
                  <div className="text-xs text-text-muted">Inactive (hover only)</div>
                </div>
              </div>
            </div>
            <CodeBlock language="tsx" code={`// Import from lucide-react
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';`} />
          </Subsection>

          <Subsection title="Accessibility">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 flex flex-col">
                <div className="font-medium text-text-primary mb-2">aria-sort Attribute</div>
                <p className="text-sm text-text-secondary mb-3">
                  Active sort column must include <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">aria-sort</code> for screen readers.
                </p>
                <div className="flex-1 [&>div]:mb-0 [&>div]:h-full [&>div>div]:h-full [&_pre]:h-full">
                  <CodeBlock language="tsx" code={`// Active column
<th aria-sort="ascending">Name</th>
<th aria-sort="descending">Date</th>

// Inactive column (omit attribute)
<th>Status</th>`} />
                </div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 flex flex-col">
                <div className="font-medium text-text-primary mb-2">Keyboard Support</div>
                <p className="text-sm text-text-secondary mb-3">
                  Sortable headers should be focusable and activated with Enter/Space.
                </p>
                <div className="flex-1 [&>div]:mb-0 [&>div]:h-full [&>div>div]:h-full [&_pre]:h-full">
                  <CodeBlock language="tsx" code={`// Use button or role="button"
<th onClick={handleSort} tabIndex={0}>

// Or wrap in button
<th><button onClick={...}>Name</button></th>`} />
                </div>
              </div>
            </div>
          </Subsection>

          <Subsection title="Implementation Pattern">
            <p className="text-sm text-text-muted mb-4">
              Extract sortable header logic into a reusable component to avoid code duplication and ensure consistency.
            </p>
            <CodeBlock language="tsx" code={`interface SortableHeaderProps {
  field: string;
  label: string;
  currentField: string;
  currentDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  align?: 'left' | 'center';
}

function SortableHeader({ field, label, currentField, currentDirection, onSort, align = 'left' }: SortableHeaderProps) {
  const isActive = currentField === field;
  const justifyClass = align === 'center' ? 'justify-center' : '';

  return (
    <th
      className="group text-left px-4 py-3 text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary select-none"
      onClick={() => onSort(field)}
      aria-sort={isActive ? (currentDirection === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <span className={\`flex items-center gap-1 \${justifyClass}\`}>
        {label}
        {isActive ? (
          <span className="text-accent">
            {currentDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        ) : (
          <span className="opacity-0 group-hover:opacity-50 transition-opacity">
            <ChevronsUpDown className="w-4 h-4" />
          </span>
        )}
      </span>
    </th>
  );
}`} />
          </Subsection>
        </Section>

        {/* Navigation Panels */}
        <Section id="nav-panels" title="Navigation Panels">
          <p className="text-text-secondary mb-6">
            Sidebar navigation patterns for content-heavy pages. Designed for scannability,
            accessibility, and accurate scroll tracking.
          </p>

          <Subsection title="Anatomy">
            <p className="text-sm text-text-muted mb-4">
              A well-designed navigation panel has distinct visual hierarchy and clear affordances.
            </p>
            <div className="flex flex-wrap gap-6">
              {/* Visual example with annotations */}
              <div className="w-56 bg-surface-card border border-border-subtle rounded-lg relative">
                {/* Top fade indicator */}
                <div className="absolute top-0 left-0 right-0 h-4 rounded-t-lg bg-gradient-to-b from-surface-card to-transparent z-10 opacity-50" />

                <div className="p-3">
                  {/* Group 1 */}
                  <div>
                    <div className="flex items-center justify-between text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1">
                      <span>Foundations</span>
                    </div>
                    <div className="space-y-px">
                      <div className="pl-3 pr-2 py-1.5 text-[13px] rounded bg-accent/10 text-accent font-medium">
                        Design Principles
                      </div>
                    </div>
                  </div>

                  {/* Group 2 - Collapsible */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1 cursor-pointer hover:text-text-muted">
                      <span>Colors</span>
                      <span className="flex items-center gap-1">
                        <span className="text-[9px] font-normal tracking-normal opacity-60">9</span>
                        <ChevronDown className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="space-y-px">
                      <div className="pl-3 pr-2 py-1.5 text-[13px] rounded text-text-secondary">Surfaces</div>
                      <div className="pl-3 pr-2 py-1.5 text-[13px] rounded text-text-secondary">Accent</div>
                      <div className="pl-3 pr-2 py-1.5 text-[13px] rounded text-text-secondary">Roles</div>
                    </div>
                  </div>

                  {/* Group 3 */}
                  <div className="mt-3">
                    <div className="text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1">
                      Components
                    </div>
                    <div className="space-y-px">
                      <div className="pl-3 pr-2 py-1.5 text-[13px] rounded text-text-secondary">Buttons</div>
                      <div className="pl-3 pr-2 py-1.5 text-[13px] rounded bg-surface-interactive text-text-primary">Badges (hover)</div>
                    </div>
                  </div>
                </div>

                {/* Bottom fade indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-4 rounded-b-lg bg-gradient-to-t from-surface-card to-transparent z-10" />
              </div>

              {/* Specs */}
              <div className="flex-1 min-w-[280px] space-y-3">
                <div className="bg-surface-elevated rounded-lg p-3 text-xs">
                  <div className="font-semibold text-text-primary mb-2">Category Headers</div>
                  <div className="font-mono text-text-secondary space-y-1">
                    <div>font-size: 9px</div>
                    <div>letter-spacing: 0.1em</div>
                    <div>color: text-muted/70</div>
                    <div>text-transform: uppercase</div>
                  </div>
                </div>
                <div className="bg-surface-elevated rounded-lg p-3 text-xs">
                  <div className="font-semibold text-text-primary mb-2">Nav Items</div>
                  <div className="font-mono text-text-secondary space-y-1">
                    <div>font-size: 13px</div>
                    <div>padding: 6px 8px 6px 12px (indent left)</div>
                    <div>min-height: 32px (touch target)</div>
                  </div>
                </div>
                <div className="bg-surface-elevated rounded-lg p-3 text-xs">
                  <div className="font-semibold text-text-primary mb-2">Group Spacing</div>
                  <div className="font-mono text-text-secondary space-y-1">
                    <div>between groups: 12px (mt-3)</div>
                    <div>between items: 1px (space-y-px)</div>
                  </div>
                </div>
              </div>
            </div>
          </Subsection>

          <Subsection title="Collapsible Groups">
            <p className="text-sm text-text-muted mb-4">
              All groups are collapsible for consistent, predictable behavior.
              Show item count badge and chevron indicator on every group header.
            </p>
            <div className="flex flex-wrap gap-4">
              {/* Expanded state */}
              <div className="w-48 bg-surface-card border border-border-subtle rounded-lg p-3">
                <div className="flex items-center justify-between text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1 cursor-pointer">
                  <span>Colors</span>
                  <span className="flex items-center gap-1">
                    <span className="text-[9px] font-normal tracking-normal opacity-60">9</span>
                    <ChevronDown className="w-3 h-3" />
                  </span>
                </div>
                <div className="space-y-px">
                  <div className="pl-3 py-1.5 text-[13px] text-text-secondary">Surfaces</div>
                  <div className="pl-3 py-1.5 text-[13px] text-text-secondary">Accent</div>
                  <div className="pl-3 py-1.5 text-[13px] text-text-secondary">...</div>
                </div>
                <div className="text-xs text-text-muted mt-2 px-1">Expanded</div>
              </div>

              {/* Collapsed state */}
              <div className="w-48 bg-surface-card border border-border-subtle rounded-lg p-3">
                <div className="flex items-center justify-between text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-1 px-1 cursor-pointer">
                  <span>Colors</span>
                  <span className="flex items-center gap-1">
                    <span className="text-[9px] font-normal tracking-normal opacity-60">9</span>
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="pl-3 py-1.5 text-[12px] text-text-muted">
                  9 items...
                </div>
                <div className="text-xs text-text-muted mt-2 px-1">Collapsed</div>
              </div>
            </div>
          </Subsection>

          <Subsection title="Scroll Indicators">
            <p className="text-sm text-text-muted mb-4">
              Fade gradients indicate scrollable content. They appear/disappear based on scroll position.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-text-primary mb-2">At Top</div>
                <div className="flex justify-center gap-2 text-xs">
                  <span className="text-text-muted">Top fade:</span>
                  <span className="text-status-error">hidden</span>
                </div>
                <div className="flex justify-center gap-2 text-xs">
                  <span className="text-text-muted">Bottom fade:</span>
                  <span className="text-status-success">visible</span>
                </div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-text-primary mb-2">Scrolling</div>
                <div className="flex justify-center gap-2 text-xs">
                  <span className="text-text-muted">Top fade:</span>
                  <span className="text-status-success">visible</span>
                </div>
                <div className="flex justify-center gap-2 text-xs">
                  <span className="text-text-muted">Bottom fade:</span>
                  <span className="text-status-success">visible</span>
                </div>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-text-primary mb-2">At Bottom</div>
                <div className="flex justify-center gap-2 text-xs">
                  <span className="text-text-muted">Top fade:</span>
                  <span className="text-status-success">visible</span>
                </div>
                <div className="flex justify-center gap-2 text-xs">
                  <span className="text-text-muted">Bottom fade:</span>
                  <span className="text-status-error">hidden</span>
                </div>
              </div>
            </div>
          </Subsection>

          <Subsection title="Scroll Tracking Algorithm">
            <p className="text-sm text-text-muted mb-4">
              Active section = the section whose heading you most recently scrolled past.
              This is predictable regardless of scroll direction or section size.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">On Click</div>
                <p className="text-sm text-text-secondary">
                  1. Set active <strong>immediately</strong><br/>
                  2. Lock scroll tracking<br/>
                  3. Smooth-scroll to section
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">On Scroll</div>
                <p className="text-sm text-text-secondary">
                  1. If locked, reset 150ms timer<br/>
                  2. Find headings above threshold<br/>
                  3. Pick the one closest to top<br/>
                  4. Fallback: first visible section
                </p>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <div className="font-medium text-text-primary mb-2">Why This Works</div>
                <p className="text-sm text-text-secondary">
                  "Most recently scrolled past" is unambiguous. Scroll up → earlier sections. Scroll down → later sections.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <CodeBlock language="typescript" code={`// "Most recently scrolled past" algorithm
const threshold = 120;
let bestSection = null, bestTop = -Infinity;

for (const section of sections) {
  const top = section.getBoundingClientRect().top;
  // Heading scrolled past if top <= threshold
  if (top <= threshold && top > bestTop) {
    bestTop = top;
    bestSection = section.id;
  }
}`} />
            </div>
          </Subsection>

          <Subsection title="Item States">
            <div className="flex flex-wrap gap-4 items-stretch">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-3 w-56">
                <div className="text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em] mb-2 px-1">
                  Interactive States
                </div>
                <div className="space-y-1">
                  <div className="pl-3 pr-2 py-1.5 text-[13px] rounded text-text-secondary">
                    Default
                  </div>
                  <div className="pl-3 pr-2 py-1.5 text-[13px] rounded bg-surface-interactive text-text-primary">
                    Hover
                  </div>
                  <div className="pl-3 pr-2 py-1.5 text-[13px] rounded bg-accent/10 text-accent font-medium">
                    Active
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-[200px] [&>div]:mb-0 [&>div>div>pre]:h-full">
                <CodeBlock language="css" code={`/* Default */
text-text-secondary

/* Hover */
hover:bg-surface-interactive
hover:text-text-primary

/* Active */
bg-accent/10 text-accent font-medium`} />
              </div>
            </div>
          </Subsection>

          <Subsection title="Panel Sizing">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Width</th>
                    <th className="text-left py-2 text-text-muted font-medium">Value</th>
                    <th className="text-left py-2 text-text-muted font-medium">Use Case</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  <tr className="border-b border-border-subtle">
                    <td className="py-2">Compact</td>
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">w-48</code> (192px)</td>
                    <td className="py-2">Short labels, flat list</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-2">Standard</td>
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">w-56</code> (224px)</td>
                    <td className="py-2">Grouped navigation with counts</td>
                  </tr>
                  <tr>
                    <td className="py-2">Wide</td>
                    <td className="py-2"><code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-accent">w-64</code> (256px)</td>
                    <td className="py-2">Icons, nested items, long labels</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Subsection>
        </Section>

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-border-default text-center text-text-muted text-sm">
            <p>FFXIV Raid Planner Design System v2.7.0</p>
            <p className="mt-1">
              <a href="/docs" className="text-accent hover:underline">
                Back to Documentation Index
              </a>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default DesignSystem;
