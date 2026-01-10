import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const GlutenFreeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 2C10.5 2 9 2.5 8 3.5L4 7.5V11L7 14L10 11V7.5L12 5.5L14 7.5V11L17 14L20 11V7.5L16 3.5C15 2.5 13.5 2 12 2Z"
      fill="currentColor"
      opacity="0.2"
    />
    <path
      d="M12 2C10.5 2 9 2.5 8 3.5L4 7.5V11L7 14L10 11V7.5L12 5.5L14 7.5V11L17 14L20 11V7.5L16 3.5C15 2.5 13.5 2 12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const DairyFreeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M18 4H6C5.44772 4 5 4.44772 5 5V8C5 8.55228 5.44772 9 6 9H18C18.5523 9 19 8.55228 19 8V5C19 4.44772 18.5523 4 18 4Z"
      fill="currentColor"
      opacity="0.2"
    />
    <path
      d="M17 9V18C17 19.1046 16.1046 20 15 20H9C7.89543 20 7 19.1046 7 18V9M18 4H6C5.44772 4 5 4.44772 5 5V8C5 8.55228 5.44772 9 6 9H18C18.5523 9 19 8.55228 19 8V5C19 4.44772 18.5523 4 18 4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const NutFreeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 7C14.2091 7 16 8.79086 16 11C16 13.2091 14.2091 15 12 15C9.79086 15 8 13.2091 8 11C8 8.79086 9.79086 7 12 7Z"
      fill="currentColor"
      opacity="0.2"
    />
    <path
      d="M12 7C14.2091 7 16 8.79086 16 11C16 13.2091 14.2091 15 12 15C9.79086 15 8 13.2091 8 11C8 8.79086 9.79086 7 12 7Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 3V7M12 15V21M7 6L9 9M15 13L17 16M3 11H8M16 11H21M7 16L9 13M15 9L17 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const VeganIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 4C12 4 8 4 8 8C8 12 12 16 12 20C12 16 16 12 16 8C16 4 12 4 12 4Z"
      fill="currentColor"
      opacity="0.2"
    />
    <path
      d="M12 4C12 4 8 4 8 8C8 12 12 16 12 20C12 16 16 12 16 8C16 4 12 4 12 4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 4C12 4 6 5 6 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const VegetarianIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="15" r="4" fill="currentColor" opacity="0.2" />
    <path
      d="M12 3V9M12 9C10 9 8 10 8 12C8 14 9 15 11 15M12 9C14 9 16 10 16 12C16 14 15 15 13 15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="15" r="4" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const ShellfishFreeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M6 12C6 9 8 7 11 7L13 7C16 7 18 9 18 12L12 19L6 12Z"
      fill="currentColor"
      opacity="0.2"
    />
    <path
      d="M6 12C6 9 8 7 11 7L13 7C16 7 18 9 18 12M12 7V19M6 12L12 19L18 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const SoyFreeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <ellipse cx="12" cy="13" rx="5" ry="6" fill="currentColor" opacity="0.2" />
    <path
      d="M12 19C14.7614 19 17 16.3137 17 13C17 9.68629 14.7614 7 12 7C9.23858 7 7 9.68629 7 13C7 16.3137 9.23858 19 12 19Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M12 7C12 7 10 5 8 5M12 7C12 7 14 5 16 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const EggFreeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 20C15.3137 20 18 16.866 18 13C18 9.13401 15.3137 5 12 5C8.68629 5 6 9.13401 6 13C6 16.866 8.68629 20 12 20Z"
      fill="currentColor"
      opacity="0.2"
    />
    <path
      d="M12 20C15.3137 20 18 16.866 18 13C18 9.13401 15.3137 5 12 5C8.68629 5 6 9.13401 6 13C6 16.866 8.68629 20 12 20Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const getDietaryIcon = (restriction: string, size: number = 20): React.ReactElement => {
  const lowerRestriction = restriction.toLowerCase();
  const className = "inline-block";

  if (lowerRestriction.includes('gluten')) return <GlutenFreeIcon size={size} className={className} />;
  if (lowerRestriction.includes('dairy') || lowerRestriction.includes('lactose')) return <DairyFreeIcon size={size} className={className} />;
  if (lowerRestriction.includes('nut') || lowerRestriction.includes('peanut')) return <NutFreeIcon size={size} className={className} />;
  if (lowerRestriction.includes('vegan')) return <VeganIcon size={size} className={className} />;
  if (lowerRestriction.includes('vegetarian')) return <VegetarianIcon size={size} className={className} />;
  if (lowerRestriction.includes('shellfish') || lowerRestriction.includes('seafood')) return <ShellfishFreeIcon size={size} className={className} />;
  if (lowerRestriction.includes('soy')) return <SoyFreeIcon size={size} className={className} />;
  if (lowerRestriction.includes('egg')) return <EggFreeIcon size={size} className={className} />;

  return <span className="text-sm">🚫</span>;
};
