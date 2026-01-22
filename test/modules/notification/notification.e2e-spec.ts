import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotificationModule } from '../../../src/modules/notification/notification.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../../src/modules/notification/notification.entity';

describe('NotificationController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Use in-memory SQLite for testing
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Notification],
          synchronize: true,
        }),
        NotificationModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/notifications (POST)', () => {
    it('should create a notification', () => {
      return request(app.getHttpServer())
        .post('/notifications')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'claim',
          title: 'Test Notification',
          message: 'This is a test notification',
          metadata: { test: 'data' },
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
          expect(res.body.title).toBe('Test Notification');
          expect(res.body.isRead).toBe(false);
        });
    });

    it('should reject invalid notification data', () => {
      return request(app.getHttpServer())
        .post('/notifications')
        .send({
          userId: 'invalid-uuid',
          type: 'invalid-type',
          title: '',
          message: '',
        })
        .expect(400);
    });
  });

  describe('/notifications/user/:userId (GET)', () => {
    it('should get notifications for a user', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/123e4567-e89b-12d3-a456-426614174000')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('notifications');
          expect(res.body).toHaveProperty('totalCount');
        });
    });
  });

  describe('/notifications/:id/user/:userId (GET)', () => {
    it('should get a specific notification', () => {
      // First create a notification
      return request(app.getHttpServer())
        .post('/notifications')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'claim',
          title: 'Test Notification',
          message: 'This is a test notification',
        })
        .expect(201)
        .then(createRes => {
          const notificationId = createRes.body.id;

          // Then get the specific notification
          return request(app.getHttpServer())
            .get(
              `/notifications/${notificationId}/user/123e4567-e89b-12d3-a456-426614174000`,
            )
            .expect(200)
            .expect(res => {
              expect(res.body.id).toBe(notificationId);
              expect(res.body.userId).toBe(
                '123e4567-e89b-12d3-a456-426614174000',
              );
            });
        });
    });
  });
});
