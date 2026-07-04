// No production module imports this barrel by path today (every consumer
// reaches these components directly, e.g. `./FilterBar`) — it's kept because
// GroupViewContent.slots.test.tsx mocks '../components/loot'. Don't delete it.
export { FilterBar, ROLE_FILTERS, type RoleFilter } from './FilterBar';
export { QuickLogWeaponModal } from './QuickLogWeaponModal';
export { LogWeekWizard } from './LogWeekWizard';
export { RoleSection, ROLE_SECTION_CONFIGS, getRoleSectionConfig, type RoleSectionConfig } from './RoleSection';
export { WeaponPriorityList } from './WeaponPriorityList';
