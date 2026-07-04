import React from 'react';
import { ChromeEdgeToggle } from '../../../components/ui/ChromeEdgeToggle';
import { CHROME_PANEL_TOGGLE_TOP_CSS } from '../../../constants/layout';

type SidebarToggleWindowsProps = {
  isOpen: boolean;
  onToggle: () => void;
  t: (key: string) => string;
};

export const SidebarToggleWindows: React.FC<SidebarToggleWindowsProps> = ({ isOpen, onToggle, t }) => (
  <ChromeEdgeToggle
    testId="workspace-sidebar-toggle"
    icon={isOpen ? 'chevron_left' : 'chevron_right'}
    title={isOpen ? t('Collapse Sidebar') : t('Expand Sidebar')}
    onClick={onToggle}
    className="absolute -right-3 transition-all duration-300"
    style={{ top: CHROME_PANEL_TOGGLE_TOP_CSS }}
  />
);
