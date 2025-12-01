import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity'; 
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AdjustStockDto, StockAdjustmentType } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
  ) {}

  async create(createInventoryItemDto: CreateInventoryItemDto): Promise<InventoryItem> {
    const inventoryItem = this.inventoryRepository.create({
      ...createInventoryItemDto,
      currentValue: 0, // Will be updated when unit cost is tracked
    });

    return await this.inventoryRepository.save(inventoryItem);
  }

  async findAll(restaurantId: number): Promise<InventoryItem[]> {
    return await this.inventoryRepository.find({
      where: { restaurantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findByCategory(restaurantId: number, category: string): Promise<InventoryItem[]> {
    return await this.inventoryRepository.find({
      where: { restaurantId, category, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findLowStock(restaurantId: number): Promise<InventoryItem[]> {
    const items = await this.inventoryRepository.find({
      where: { restaurantId, isActive: true },
      order: { name: 'ASC' },
    });

    return items.filter((item) => Number(item.quantity) <= Number(item.reorderLevel));
  }

  async findOutOfStock(restaurantId: number): Promise<InventoryItem[]> {
    return await this.inventoryRepository.find({
      where: { restaurantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<InventoryItem> {
    const item = await this.inventoryRepository.findOne({
      where: { id },
      relations: ['restaurant'],
    });

    if (!item) {
      throw new NotFoundException(`Inventory item #${id} not found`);
    }

    return item;
  }

  async update(
    id: number,
    updateInventoryItemDto: UpdateInventoryItemDto,
  ): Promise<InventoryItem> {
    const item = await this.findOne(id);
    Object.assign(item, updateInventoryItemDto);
    await this.inventoryRepository.save(item);
    return await this.findOne(id);
  }

  async adjustStock(id: number, adjustDto: AdjustStockDto): Promise<InventoryItem> {
    const item = await this.findOne(id);
    const currentQuantity = Number(item.quantity);
    const adjustmentQuantity = Number(adjustDto.quantity);

    switch (adjustDto.type) {
      case StockAdjustmentType.ADD:
        item.quantity = currentQuantity + adjustmentQuantity;
        break;

      case StockAdjustmentType.SUBTRACT:
        const newQuantity = currentQuantity - adjustmentQuantity;
        if (newQuantity < 0) {
          throw new BadRequestException('Cannot reduce stock below zero');
        }
        item.quantity = newQuantity;
        break;

      case StockAdjustmentType.SET:
        if (adjustmentQuantity < 0) {
          throw new BadRequestException('Quantity cannot be negative');
        }
        item.quantity = adjustmentQuantity;
        break;
    }

    await this.inventoryRepository.save(item);
    return await this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    item.isActive = false;
    await this.inventoryRepository.save(item);
  }

  async getInventoryStatistics(restaurantId: number) {
    const items = await this.findAll(restaurantId);
    const lowStockItems = await this.findLowStock(restaurantId);
    const outOfStockItems = items.filter((item) => Number(item.quantity) === 0);

    const byCategory = items.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { count: 0, totalValue: 0, items: [] };
      }
      acc[category].count++;
      acc[category].totalValue += Number(item.currentValue);
      acc[category].items.push(item.name);
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; items: string[] }>);

    return {
      totalItems: items.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      totalValue: items.reduce((sum, item) => sum + Number(item.currentValue), 0),
      byCategory,
      lowStockItems: lowStockItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        unit: item.unit,
      })),
    };
  }

  async bulkAdjustStock(
    adjustments: Array<{ id: number; quantity: number; type: StockAdjustmentType }>,
  ): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];

    for (const adjustment of adjustments) {
      const item = await this.adjustStock(adjustment.id, {
        type: adjustment.type,
        quantity: adjustment.quantity,
      });
      results.push(item);
    }

    return results;
  }
}