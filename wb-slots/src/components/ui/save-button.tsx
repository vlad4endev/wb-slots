import * as React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { FiRefreshCw as RefreshCw, FiSave as Save } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface SaveButtonProps extends Omit<ButtonProps, 'children'> {
  isLoading?: boolean;
  children?: React.ReactNode;
  loadingText?: string;
}

export function SaveButton({ 
  isLoading = false, 
  children, 
  loadingText = 'Сохранение...',
  className,
  ...props 
}: SaveButtonProps) {
  return (
    <Button 
      disabled={isLoading || props.disabled}
      className={cn('flex items-center gap-2', className)}
      {...props}
    >
      {isLoading ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          {children || 'Сохранить'}
        </>
      )}
    </Button>
  );
}

