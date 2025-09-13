// ===== CLEAN ARCHITECTURE EXAMPLE =====
// Этот файл демонстрирует правильную архитектуру с разделением на слои

// ===== DOMAIN LAYER (Бизнес-логика) =====

// Domain Entities
export interface Slot {
  readonly id: string;
  readonly warehouseId: number;
  readonly warehouseName: string;
  readonly date: string;
  readonly timeSlot: string;
  readonly coefficient: number;
  readonly isAvailable: boolean;
  readonly boxTypes: number[];
  readonly foundAt: Date;
}

export interface Task {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly filters: TaskFilters;
  readonly autoBook: boolean;
  readonly autoBookSupplyId?: string;
}

export interface TaskFilters {
  readonly warehouseIds: number[];
  readonly boxTypeIds: number[];
  readonly coefficientMin: number;
  readonly coefficientMax: number;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly isSortingCenter: boolean;
}

// Domain Value Objects
export class Coefficient {
  private constructor(private readonly value: number) {
    if (value < 0 || value > 20) {
      throw new Error('Coefficient must be between 0 and 20');
    }
  }

  static create(value: number): Coefficient {
    return new Coefficient(value);
  }

  getValue(): number {
    return this.value;
  }

  isBetterThan(other: Coefficient): boolean {
    return this.value < other.value; // Lower is better
  }
}

export class WarehouseId {
  private constructor(private readonly value: number) {
    if (value <= 0) {
      throw new Error('Warehouse ID must be positive');
    }
  }

  static create(value: number): WarehouseId {
    return new WarehouseId(value);
  }

  getValue(): number {
    return this.value;
  }
}

// Domain Services
export interface SlotSearchService {
  searchSlots(filters: TaskFilters): Promise<Slot[]>;
}

export interface NotificationService {
  sendSlotFoundNotification(slots: Slot[], task: Task): Promise<void>;
}

export interface AutoBookingService {
  bookSlot(slot: Slot, supplyId: string): Promise<BookingResult>;
}

export interface BookingResult {
  readonly success: boolean;
  readonly bookingId?: string;
  readonly error?: string;
}

// Domain Events
export interface DomainEvent {
  readonly occurredOn: Date;
  readonly eventType: string;
}

export class SlotFoundEvent implements DomainEvent {
  readonly occurredOn: Date = new Date();
  readonly eventType = 'SLOT_FOUND';

  constructor(
    public readonly slots: Slot[],
    public readonly taskId: string
  ) {}
}

export class SlotBookedEvent implements DomainEvent {
  readonly occurredOn: Date = new Date();
  readonly eventType = 'SLOT_BOOKED';

  constructor(
    public readonly slot: Slot,
    public readonly bookingId: string
  ) {}
}

// ===== APPLICATION LAYER (Use Cases) =====

export interface SlotSearchUseCase {
  execute(request: SlotSearchRequest): Promise<SlotSearchResponse>;
}

export interface SlotSearchRequest {
  readonly taskId: string;
  readonly userId: string;
  readonly filters: TaskFilters;
  readonly stopOnFirstFound: boolean;
}

export interface SlotSearchResponse {
  readonly slots: Slot[];
  readonly totalChecked: number;
  readonly searchTime: number;
  readonly errors: string[];
  readonly stoppedEarly: boolean;
}

export class SlotSearchUseCaseImpl implements SlotSearchUseCase {
  constructor(
    private readonly slotSearchService: SlotSearchService,
    private readonly notificationService: NotificationService,
    private readonly autoBookingService: AutoBookingService,
    private readonly taskRepository: TaskRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(request: SlotSearchRequest): Promise<SlotSearchResponse> {
    const startTime = Date.now();
    const errors: string[] = [];
    let totalChecked = 0;
    let stoppedEarly = false;

    try {
      // Get task
      const task = await this.taskRepository.findById(request.taskId);
      if (!task) {
        throw new Error(`Task ${request.taskId} not found`);
      }

      // Search for slots
      const slots = await this.slotSearchService.searchSlots(request.filters);
      totalChecked = slots.length;

      // Handle found slots
      if (slots.length > 0) {
        // Send notification
        await this.notificationService.sendSlotFoundNotification(slots, task);

        // Publish domain event
        await this.eventBus.publish(new SlotFoundEvent(slots, request.taskId));

        // Auto-booking if enabled
        if (task.autoBook && task.autoBookSupplyId) {
          await this.handleAutoBooking(slots, task.autoBookSupplyId);
        }

        // Stop early if requested
        if (request.stopOnFirstFound) {
          stoppedEarly = true;
        }
      }

      return {
        slots,
        totalChecked,
        searchTime: Date.now() - startTime,
        errors,
        stoppedEarly,
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        slots: [],
        totalChecked,
        searchTime: Date.now() - startTime,
        errors,
        stoppedEarly: true,
      };
    }
  }

  private async handleAutoBooking(slots: Slot[], supplyId: string): Promise<void> {
    for (const slot of slots) {
      try {
        const result = await this.autoBookingService.bookSlot(slot, supplyId);
        
        if (result.success) {
          await this.eventBus.publish(new SlotBookedEvent(slot, result.bookingId!));
        }
      } catch (error) {
        console.error('Auto-booking failed:', error);
      }
    }
  }
}

// ===== INFRASTRUCTURE LAYER (External Dependencies) =====

// Repositories
export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  save(task: Task): Promise<void>;
}

export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: any) {}

  async findById(id: string): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) return null;

    return {
      id: task.id,
      userId: task.userId,
      name: task.name,
      enabled: task.enabled,
      filters: task.filters as TaskFilters,
      autoBook: task.autoBook,
      autoBookSupplyId: task.autoBookSupplyId,
    };
  }

  async save(task: Task): Promise<void> {
    await this.prisma.task.upsert({
      where: { id: task.id },
      update: {
        enabled: task.enabled,
        filters: task.filters,
        autoBook: task.autoBook,
        autoBookSupplyId: task.autoBookSupplyId,
      },
      create: {
        id: task.id,
        userId: task.userId,
        name: task.name,
        enabled: task.enabled,
        filters: task.filters,
        autoBook: task.autoBook,
        autoBookSupplyId: task.autoBookSupplyId,
      },
    });
  }
}

// External Services
export class WBAPISlotSearchService implements SlotSearchService {
  constructor(private readonly wbClient: any) {}

  async searchSlots(filters: TaskFilters): Promise<Slot[]> {
    const rawSlots = await this.wbClient.searchAvailableSlots(
      filters.warehouseIds,
      filters.boxTypeIds,
      filters.dateFrom,
      filters.dateTo,
      filters.coefficientMin,
      filters.isSortingCenter
    );

    return rawSlots
      .filter(slot => this.isSlotValid(slot, filters))
      .map(slot => this.convertToSlot(slot));
  }

  private isSlotValid(slot: any, filters: TaskFilters): boolean {
    return slot &&
           slot.warehouseID &&
           slot.date &&
           slot.coefficient >= filters.coefficientMin &&
           slot.coefficient <= filters.coefficientMax &&
           filters.warehouseIds.includes(slot.warehouseID);
  }

  private convertToSlot(slot: any): Slot {
    return {
      id: `${slot.warehouseID}-${slot.date}`,
      warehouseId: slot.warehouseID,
      warehouseName: slot.warehouseName || `Склад ${slot.warehouseID}`,
      date: slot.date,
      timeSlot: slot.timeSlot || 'Не указано',
      coefficient: slot.coefficient,
      isAvailable: true,
      boxTypes: slot.boxTypes || [],
      foundAt: new Date(),
    };
  }
}

export class TelegramNotificationService implements NotificationService {
  constructor(private readonly telegramService: any) {}

  async sendSlotFoundNotification(slots: Slot[], task: Task): Promise<void> {
    const message = this.buildMessage(slots, task);
    await this.telegramService.sendNotification(task.userId, message);
  }

  private buildMessage(slots: Slot[], task: Task): string {
    const bestSlot = slots[0]; // Assuming sorted by coefficient
    
    let message = `🎯 Найдены слоты для "${task.name}"!\n\n`;
    message += `📊 Всего найдено: ${slots.length} слотов\n`;
    message += `🏆 Лучший слот:\n`;
    message += `   🏪 Склад: ${bestSlot.warehouseName}\n`;
    message += `   📅 Дата: ${bestSlot.date}\n`;
    message += `   💰 Коэффициент: ${bestSlot.coefficient}\n`;

    return message;
  }
}

// Event Bus
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  async publish(event: DomainEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventType) || [];
    
    for (const handler of eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error handling event ${event.eventType}:`, error);
      }
    }
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }
}

// ===== PRESENTATION LAYER (Controllers) =====

export class SlotSearchController {
  constructor(private readonly slotSearchUseCase: SlotSearchUseCase) {}

  async searchSlots(request: any): Promise<any> {
    try {
      const response = await this.slotSearchUseCase.execute({
        taskId: request.taskId,
        userId: request.userId,
        filters: request.filters,
        stopOnFirstFound: request.stopOnFirstFound,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ===== DEPENDENCY INJECTION CONTAINER =====

export class DIContainer {
  private services = new Map<string, any>();

  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory);
  }

  get<T>(name: string): T {
    const factory = this.services.get(name);
    if (!factory) {
      throw new Error(`Service ${name} not found`);
    }
    return factory();
  }
}

// ===== APPLICATION FACTORY =====

export class ApplicationFactory {
  static createApplication(prisma: any, wbClient: any, telegramService: any): {
    slotSearchController: SlotSearchController;
    eventBus: EventBus;
  } {
    const container = new DIContainer();

    // Register services
    container.register('prisma', () => prisma);
    container.register('wbClient', () => wbClient);
    container.register('telegramService', () => telegramService);
    container.register('eventBus', () => new InMemoryEventBus());
    container.register('taskRepository', () => new PrismaTaskRepository(container.get('prisma')));
    container.register('slotSearchService', () => new WBAPISlotSearchService(container.get('wbClient')));
    container.register('notificationService', () => new TelegramNotificationService(container.get('telegramService')));
    container.register('slotSearchUseCase', () => new SlotSearchUseCaseImpl(
      container.get('slotSearchService'),
      container.get('notificationService'),
      container.get('autoBookingService'),
      container.get('taskRepository'),
      container.get('eventBus')
    ));

    return {
      slotSearchController: new SlotSearchController(container.get('slotSearchUseCase')),
      eventBus: container.get('eventBus'),
    };
  }
}

// ===== USAGE EXAMPLE =====

/*
// In your API route:
const { slotSearchController, eventBus } = ApplicationFactory.createApplication(
  prisma,
  wbClient,
  telegramService
);

// Set up event handlers
eventBus.subscribe('SLOT_FOUND', async (event) => {
  console.log('Slots found:', event.slots);
});

eventBus.subscribe('SLOT_BOOKED', async (event) => {
  console.log('Slot booked:', event.bookingId);
});

// Use the controller
const result = await slotSearchController.searchSlots({
  taskId: 'task-123',
  userId: 'user-456',
  filters: {
    warehouseIds: [1, 2, 3],
    boxTypeIds: [2, 5],
    coefficientMin: 0,
    coefficientMax: 10,
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31',
    isSortingCenter: false,
  },
  stopOnFirstFound: true,
});
*/
