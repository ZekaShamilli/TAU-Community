/**
 * Database seeding script for TAU Community system
 * Creates initial data for development and testing
 */

import { PrismaClient, UserRole, ActivityStatus, ApplicationStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('ðŸŒ± Starting database seeding...');

  try {
    // Clear existing data in development
    if (process.env.NODE_ENV === 'development') {
      console.log('ðŸ§¹ Clearing existing data...');
      await prisma.auditLog.deleteMany();
      await prisma.application.deleteMany();
      await prisma.activity.deleteMany();
      await prisma.club.deleteMany();
      await prisma.user.deleteMany();
    }

    // Hash password for all users (same password for development)
    const passwordHash = await bcrypt.hash('password123', 10);

    console.log('ðŸ‘¤ Creating users...');

    // Create Super Admin
    const superAdmin = await prisma.user.create({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@tau.edu.az',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        firstName: 'System',
        lastName: 'Administrator',
        totpEnabled: true,
      },
    });

    // Create Club Presidents
    const roboticsPresident = await prisma.user.create({
      data: {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'president.robotics@tau.edu.az',
        passwordHash,
        role: UserRole.CLUB_PRESIDENT,
        firstName: 'Ahmet',
        lastName: 'YÄ±lmaz',
        phone: '+90 532 123 4567',
      },
    });

    const musicPresident = await prisma.user.create({
      data: {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'president.music@tau.edu.az',
        passwordHash,
        role: UserRole.CLUB_PRESIDENT,
        firstName: 'Elif',
        lastName: 'Kaya',
        phone: '+90 532 234 5678',
      },
    });

    const dramaPresident = await prisma.user.create({
      data: {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'president.drama@tau.edu.az',
        passwordHash,
        role: UserRole.CLUB_PRESIDENT,
        firstName: 'Mehmet',
        lastName: 'Ã–zkan',
        phone: '+90 532 345 6789',
      },
    });

    // Create Students
    const student1 = await prisma.user.create({
      data: {
        id: '55555555-5555-5555-5555-555555555555',
        email: 'student1@tau.edu.az',
        passwordHash,
        role: UserRole.STUDENT,
        firstName: 'AyÅŸe',
        lastName: 'Demir',
      },
    });

    const student2 = await prisma.user.create({
      data: {
        id: '66666666-6666-6666-6666-666666666666',
        email: 'student2@tau.edu.az',
        passwordHash,
        role: UserRole.STUDENT,
        firstName: 'Can',
        lastName: 'Åžahin',
      },
    });

    const student3 = await prisma.user.create({
      data: {
        id: '77777777-7777-7777-7777-777777777777',
        email: 'student3@tau.edu.az',
        passwordHash,
        role: UserRole.STUDENT,
        firstName: 'Zeynep',
        lastName: 'Arslan',
      },
    });

    console.log('ðŸ›ï¸ Creating clubs...');

    // Create Clubs with URL slugs
    const roboticsClub = await prisma.club.create({
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'TAU Robotics Club',
        description: 'A club dedicated to robotics research, competitions, and innovation. We build robots, participate in national competitions, and organize workshops for students interested in robotics and automation.',
        urlSlug: 'tau-robotics-club',
        presidentId: roboticsPresident.id,
      },
    });

    const musicClub = await prisma.club.create({
      data: {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'TAU Music Society',
        description: 'The official music society of TAU, bringing together musicians of all levels. We organize concerts, jam sessions, and music workshops. Whether you play an instrument or just love music, you are welcome!',
        urlSlug: 'tau-music-society',
        presidentId: musicPresident.id,
      },
    });

    const dramaClub = await prisma.club.create({
      data: {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        name: 'TAU Drama Club',
        description: 'TAU Drama Club is where creativity meets performance. We produce original plays, organize theater workshops, and participate in inter-university drama festivals. Join us to explore the world of theater!',
        urlSlug: 'tau-drama-club',
        presidentId: dramaPresident.id,
      },
    });

    console.log('ðŸŽ¯ Creating activities...');

    // Create Activities
    const activities = [
      // Robotics Club Activities
      {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        clubId: roboticsClub.id,
        title: 'Arduino Workshop for Beginners',
        description: 'Learn the basics of Arduino programming and electronics. This hands-on workshop will cover basic circuits, sensors, and programming concepts. Perfect for beginners!',
        startDate: new Date('2024-02-15T14:00:00Z'),
        endDate: new Date('2024-02-15T17:00:00Z'),
        location: 'Engineering Building - Lab 201',
        maxParticipants: 25,
        createdBy: roboticsPresident.id,
        status: ActivityStatus.PUBLISHED,
      },
      {
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        clubId: roboticsClub.id,
        title: 'National Robotics Competition Preparation',
        description: 'Intensive preparation sessions for the upcoming national robotics competition. Team formation and project planning.',
        startDate: new Date('2024-02-20T10:00:00Z'),
        endDate: new Date('2024-02-20T16:00:00Z'),
        location: 'Robotics Lab',
        maxParticipants: 15,
        createdBy: roboticsPresident.id,
        status: ActivityStatus.PUBLISHED,
      },
      // Music Society Activities
      {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        clubId: musicClub.id,
        title: 'Open Mic Night',
        description: 'Monthly open mic night where students can showcase their musical talents. All genres welcome! Bring your instruments or use ours.',
        startDate: new Date('2024-02-18T19:00:00Z'),
        endDate: new Date('2024-02-18T22:00:00Z'),
        location: 'Student Center - Main Hall',
        maxParticipants: 100,
        createdBy: musicPresident.id,
        status: ActivityStatus.PUBLISHED,
      },
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        clubId: musicClub.id,
        title: 'Guitar Workshop Series',
        description: 'Weekly guitar workshops covering different techniques and styles. From beginner to advanced levels. Guitars provided for beginners.',
        startDate: new Date('2024-02-22T18:00:00Z'),
        endDate: new Date('2024-02-22T20:00:00Z'),
        location: 'Music Room - Building C',
        maxParticipants: 20,
        createdBy: musicPresident.id,
        status: ActivityStatus.PUBLISHED,
      },
      // Drama Club Activities
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        clubId: dramaClub.id,
        title: 'Improvisation Workshop',
        description: 'Learn the art of improvisation! This workshop will help you develop quick thinking, creativity, and confidence on stage.',
        startDate: new Date('2024-02-25T16:00:00Z'),
        endDate: new Date('2024-02-25T18:00:00Z'),
        location: 'Drama Studio',
        maxParticipants: 15,
        createdBy: dramaPresident.id,
        status: ActivityStatus.PUBLISHED,
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        clubId: dramaClub.id,
        title: 'Spring Play Auditions',
        description: 'Auditions for our spring semester play "The Importance of Being Earnest". All students welcome to audition for various roles.',
        startDate: new Date('2024-03-01T14:00:00Z'),
        endDate: new Date('2024-03-01T18:00:00Z'),
        location: 'Main Theater',
        maxParticipants: 50,
        createdBy: dramaPresident.id,
        status: ActivityStatus.DRAFT,
      },
    ];

    for (const activity of activities) {
      await prisma.activity.create({ data: activity });
    }

    console.log('ðŸ“ Creating applications...');

    // Create Applications
    const applications = [
      // Approved application
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
        clubId: roboticsClub.id,
        studentId: student1.id,
        studentName: 'AyÅŸe Demir',
        studentEmail: 'student1@tau.edu.az',
        motivation: 'I have always been fascinated by robotics and automation. I have some experience with programming and would love to learn more about building robots and participating in competitions.',
        status: ApplicationStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: roboticsPresident.id,
        reviewComments: 'Great motivation and background. Welcome to the club!',
      },
      // Pending applications
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
        clubId: musicClub.id,
        studentId: student2.id,
        studentName: 'Can Åžahin',
        studentEmail: 'student2@tau.edu.az',
        motivation: 'Music has been my passion since childhood. I play guitar and piano, and I would love to collaborate with other musicians and perform in concerts.',
        status: ApplicationStatus.PENDING,
      },
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad',
        clubId: dramaClub.id,
        studentId: student3.id,
        studentName: 'Zeynep Arslan',
        studentEmail: 'student3@tau.edu.az',
        motivation: 'I have been interested in theater since high school. I participated in several school plays and would love to continue acting and maybe try directing as well.',
        status: ApplicationStatus.PENDING,
      },
      // Rejected application
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae',
        clubId: roboticsClub.id,
        studentId: student3.id,
        studentName: 'Zeynep Arslan',
        studentEmail: 'student3@tau.edu.az',
        motivation: 'I want to join because robots are cool.',
        status: ApplicationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: roboticsPresident.id,
        reviewComments: 'Application lacks sufficient detail and commitment. Please reapply with more specific motivation.',
      },
    ];

    for (const application of applications) {
      await prisma.application.create({ data: application });
    }

    console.log('ðŸ“Š Creating audit log entries...');

    // Create sample audit log entries
    const auditEntries = [
      {
        userId: superAdmin.id,
        userRole: UserRole.SUPER_ADMIN,
        action: 'CREATE_CLUB',
        resource: 'clubs',
        resourceId: roboticsClub.id,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: true,
      },
      {
        userId: roboticsPresident.id,
        userRole: UserRole.CLUB_PRESIDENT,
        action: 'CREATE_ACTIVITY',
        resource: 'activities',
        resourceId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: true,
      },
      {
        userId: student1.id,
        userRole: UserRole.STUDENT,
        action: 'SUBMIT_APPLICATION',
        resource: 'applications',
        resourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        success: true,
      },
    ];

    for (const entry of auditEntries) {
      await prisma.auditLog.create({ data: entry });
    }

    console.log('âœ… Database seeding completed successfully!');
    console.log(`
ðŸ“Š Created:
- ${await prisma.user.count()} users
- ${await prisma.club.count()} clubs  
- ${await prisma.activity.count()} activities
- ${await prisma.application.count()} applications
- ${await prisma.auditLog.count()} audit log entries

ðŸ” Test Credentials:
- Super Admin: admin@tau.edu.az / password123
- Club President (Robotics): president.robotics@tau.edu.az / password123
- Club President (Music): president.music@tau.edu.az / password123
- Club President (Drama): president.drama@tau.edu.az / password123
- Student: student1@tau.edu.az / password123
    `);

  } catch (error) {
    console.error('âŒ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
