
import React from 'react';
import { Wheat, Cookie } from 'lucide-react';
import { ResourceType, ProductType } from '../types';

export const RESOURCE_ICONS: Record<ResourceType | ProductType, React.ReactNode> = {
  [ResourceType.GRAIN]: <Wheat className="w-4 h-4 text-amber-300" />,
  [ProductType.BREAD]: <Cookie className="w-4 h-4 text-orange-400" />,
};
