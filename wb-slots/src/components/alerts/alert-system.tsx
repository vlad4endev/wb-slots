"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatedContainer } from '@/components/ui/animated-container';
import { ResponsiveGrid, useScreenSize } from '@/components/ui/mobile-optimized';
import { 
  Bell, 
  BellOff, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle,
  Mail,
  MessageSquare,
  Smartphone,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Zap,
  Database,
  Globe,
  Activity,
  Clock,
  RefreshCw
} from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: AlertChannel[];
  cooldown: number; // minutes
  lastTriggered?: string;
  triggerCount: number;
}

interface AlertChannel {
  id: string;
  type: 'email' | 'telegram' | 'webhook' | 'browser';
  name: string;
  config: Record<string, any>;
  enabled: boolean;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  metadata: Record<string, any>;
}

interface AlertSystemProps {
  userId?: string;
  onAlert?: (alert: Alert) => void;
}

export function AlertSystem({ userId, onAlert }: AlertSystemProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('alerts');
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [globalMute, setGlobalMute] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const screenSize = useScreenSize();

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`/api/alerts?userId=${userId || ''}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setRules(data.rules || []);
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAlerts();
    
    // Poll for new alerts
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
            : alert
        ));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, status: 'resolved', resolvedAt: new Date().toISOString() }
            : alert
        ));
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (response.ok) {
        setRules(prev => prev.map(rule => 
          rule.id === ruleId ? { ...rule, enabled } : rule
        ));
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5" />;
      case 'high': return <AlertTriangle className="w-5 h-5" />;
      case 'medium': return <Info className="w-5 h-5" />;
      case 'low': return <CheckCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="destructive">Активно</Badge>;
      case 'acknowledged': return <Badge variant="secondary">Подтверждено</Badge>;
      case 'resolved': return <Badge variant="default">Решено</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const AlertCard = ({ alert }: { alert: Alert }) => (
    <AnimatedContainer animation="slideInLeft" trigger="onScroll">
      <Card className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {getSeverityIcon(alert.severity)}
              <div>
                <h4 className="font-semibold">{alert.ruleName}</h4>
                <p className="text-sm text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(alert.status)}
            </div>
          </div>
          
          <p className="text-foreground mb-4">{alert.message}</p>
          
          <div className="flex items-center gap-2">
            {alert.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Подтвердить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResolveAlert(alert.id)}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Решить
                </Button>
              </>
            )}
            {alert.status === 'acknowledged' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolveAlert(alert.id)}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Решить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </AnimatedContainer>
  );

  const RuleCard = ({ rule }: { rule: AlertRule }) => (
    <AnimatedContainer animation="scaleIn" trigger="onScroll">
      <Card className="hover-lift">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold">{rule.name}</h4>
                <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                  {rule.enabled ? 'Включено' : 'Отключено'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {rule.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{rule.metric} {rule.condition} {rule.threshold}</span>
                <span>Срабатываний: {rule.triggerCount}</span>
                {rule.lastTriggered && (
                  <span>Последний: {new Date(rule.lastTriggered).toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingRule(rule)}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getSeverityIcon(rule.severity)}
            <span className="text-sm capitalize">{rule.severity}</span>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">Каналов: {rule.channels.length}</span>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">Кулдаун: {rule.cooldown}м</span>
          </div>
        </CardContent>
      </Card>
    </AnimatedContainer>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Система алертов</h2>
          <p className="text-muted-foreground">
            Мониторинг и уведомления о критических событиях
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="sound-toggle" className="text-sm">Звук</Label>
            <Switch
              id="sound-toggle"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mute-toggle" className="text-sm">Отключить все</Label>
            <Switch
              id="mute-toggle"
              checked={globalMute}
              onCheckedChange={setGlobalMute}
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchAlerts}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
        <AnimatedContainer animation="scaleIn" trigger="onScroll">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Активные</p>
                  <p className="text-xl font-bold">
                    {alerts.filter(a => a.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        <AnimatedContainer animation="scaleIn" trigger="onScroll" delay={0.1}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Подтвержденные</p>
                  <p className="text-xl font-bold">
                    {alerts.filter(a => a.status === 'acknowledged').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        <AnimatedContainer animation="scaleIn" trigger="onScroll" delay={0.2}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Решенные</p>
                  <p className="text-xl font-bold">
                    {alerts.filter(a => a.status === 'resolved').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        <AnimatedContainer animation="scaleIn" trigger="onScroll" delay={0.3}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Правила</p>
                  <p className="text-xl font-bold">{rules.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>
      </ResponsiveGrid>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alerts">Алерты</TabsTrigger>
          <TabsTrigger value="rules">Правила</TabsTrigger>
          <TabsTrigger value="channels">Каналы</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Активные алерты</h3>
            <div className="flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="acknowledged">Подтвержденные</SelectItem>
                  <SelectItem value="resolved">Решенные</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Нет алертов</h3>
                  <p className="text-muted-foreground">
                    Все системы работают нормально
                  </p>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Правила алертов</h3>
            <Button onClick={() => setShowCreateRule(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Создать правило
            </Button>
          </div>

          <div className="space-y-4">
            {rules.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Settings className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Нет правил</h3>
                  <p className="text-muted-foreground mb-4">
                    Создайте правила для мониторинга системы
                  </p>
                  <Button onClick={() => setShowCreateRule(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать первое правило
                  </Button>
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Каналы уведомлений</h3>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить канал
            </Button>
          </div>

          <ResponsiveGrid cols={{ mobile: 1, desktop: 2 }}>
            {channels.map((channel) => (
              <AnimatedContainer key={channel.id} animation="scaleIn" trigger="onScroll">
                <Card className="hover-lift">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {channel.type === 'email' && <Mail className="w-5 h-5 text-primary" />}
                        {channel.type === 'telegram' && <MessageSquare className="w-5 h-5 text-primary" />}
                        {channel.type === 'webhook' && <Globe className="w-5 h-5 text-primary" />}
                        {channel.type === 'browser' && <Bell className="w-5 h-5 text-primary" />}
                        <div>
                          <h4 className="font-semibold">{channel.name}</h4>
                          <p className="text-sm text-muted-foreground capitalize">
                            {channel.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                          {channel.enabled ? 'Включено' : 'Отключено'}
                        </Badge>
                        <Button size="sm" variant="ghost">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {Object.entries(channel.config).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span>{key}:</span>
                          <span className="font-mono text-xs">{String(value).substring(0, 20)}...</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedContainer>
            ))}
          </ResponsiveGrid>
        </TabsContent>
      </Tabs>
    </div>
  );
}
