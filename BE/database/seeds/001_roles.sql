INSERT INTO roles (code, name, description)
VALUES
  ('ADMIN', 'Admin', 'System administrator'),
  ('PART_LEADER', 'Part Leader', 'Creates and manages exams for own part'),
  ('EMPLOYEE', 'Employee', 'Takes assigned exams')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);
