import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Restaurant } from '../../restaurants/entities/restaurant.entity'; 
import { UserRole } from '../../common/enums'; 
import { Exclude } from 'class-transformer';
import { Order } from '../../orders/entities/order.entity'; 
// import { RefreshTokenDto } from 'src/auth/dto/refresh-token.dto'; 

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  restaurantId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude() // Don't expose password in responses
  password: string;

  @Column({ type: 'varchar', length: 50, default: UserRole.WAITER })
  role: UserRole;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'bit', default: true })
  canLogin: boolean;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastLogin: Date;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.users, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @OneToMany(() => Order, (order) => order.waiter)
  orders: Order[];
  // @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  // refreshTokens: RefreshToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
