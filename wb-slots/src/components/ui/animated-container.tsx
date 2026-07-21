"use client"

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedContainerProps {
  children: React.ReactNode;
  animation?: 'fadeIn' | 'slideInLeft' | 'slideInRight' | 'slideInTop' | 'slideInBottom' | 'scaleIn' | 'bounce' | 'float' | 'glow';
  delay?: number;
  duration?: number;
  trigger?: 'onMount' | 'onScroll' | 'onHover' | 'onClick';
  className?: string;
  threshold?: number;
  once?: boolean;
}

export function AnimatedContainer({
  children,
  animation = 'fadeIn',
  delay = 0,
  duration = 0.5,
  trigger = 'onMount',
  className,
  threshold = 0.1,
  once = true
}: AnimatedContainerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const animationClasses = {
    fadeIn: 'animate-fade-in',
    slideInLeft: 'animate-slide-in-left',
    slideInRight: 'animate-slide-in-right',
    slideInTop: 'animate-slide-in-top',
    slideInBottom: 'animate-slide-in-bottom',
    scaleIn: 'animate-scale-in',
    bounce: 'animate-bounce',
    float: 'animate-float',
    glow: 'animate-glow'
  };

  useEffect(() => {
    if (trigger === 'onMount') {
      const timer = setTimeout(() => {
        setIsVisible(true);
        setIsTriggered(true);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [trigger, delay]);

  useEffect(() => {
    if (trigger === 'onScroll' && elementRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) {
              setIsTriggered(true);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        },
        { threshold }
      );

      observer.observe(elementRef.current);
      return () => observer.disconnect();
    }
  }, [trigger, threshold, once]);

  const handleMouseEnter = () => {
    if (trigger === 'onHover' && !isTriggered) {
      setIsVisible(true);
      if (once) {
        setIsTriggered(true);
      }
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'onHover' && !once) {
      setIsVisible(false);
    }
  };

  const handleClick = () => {
    if (trigger === 'onClick') {
      setIsVisible(!isVisible);
    }
  };

  const shouldAnimate = trigger === 'onMount' ? isVisible : 
                       trigger === 'onScroll' ? isVisible :
                       trigger === 'onHover' ? isVisible :
                       trigger === 'onClick' ? isVisible : false;

  return (
    <div
      ref={elementRef}
      className={cn(
        'transition-all duration-300 ease-out',
        shouldAnimate ? animationClasses[animation] : 'opacity-0',
        className
      )}
      data-animation-delay={delay}
      data-animation-duration={duration}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

// Staggered animation wrapper
interface StaggeredContainerProps {
  children: React.ReactNode[];
  animation?: AnimatedContainerProps['animation'];
  staggerDelay?: number;
  className?: string;
}

export function StaggeredContainer({
  children,
  animation = 'fadeIn',
  staggerDelay = 0.1,
  className
}: StaggeredContainerProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <AnimatedContainer
          key={index}
          animation={animation}
          delay={index * staggerDelay}
          trigger="onScroll"
        >
          {child}
        </AnimatedContainer>
      ))}
    </div>
  );
}

// Loading skeleton component
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'avatar' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ 
  className, 
  variant = 'rectangular',
  width,
  height 
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';
  
  const variantClasses = {
    text: 'h-4 rounded',
    avatar: 'h-10 w-10 rounded-full',
    rectangular: 'rounded',
    circular: 'rounded-full'
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        className
      )}
      data-width={width || (variant === 'avatar' ? '2.5rem' : '100%')}
      data-height={height || (variant === 'avatar' ? '2.5rem' : '1rem')}
    />
  );
}

// Shimmer effect component
interface ShimmerProps {
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export function Shimmer({ children, className, isLoading = false }: ShimmerProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
    </div>
  );
}
