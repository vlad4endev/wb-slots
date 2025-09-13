export declare class CreateTaskDto {
    name: string;
    description?: string;
    schedule: string;
    filters: any;
    isActive?: boolean;
    autoBook?: boolean;
    autoBookSupplyId?: string;
    chosenSupplyId?: string;
}
