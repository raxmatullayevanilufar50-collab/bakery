-- Kompaniyani (va shu bilan uning barcha mahsulot/profillarini) o'chirishda
-- "violates foreign key constraint" xatosiga uchramaslik uchun — bir nechta
-- jadval product_id/profile_id'ga ON DELETE CASCADE'siz bog'langan edi.
-- Amaliy ishlashda profillar deyarli hech qachon qattiq o'chirilmaydi
-- (is_active=false ishlatiladi), shuning uchun bu faqat butun kompaniya
-- o'chirilganda ahamiyatli — va aynan o'sha holatda hamma narsa birga
-- yo'qolishi to'g'ri xulq-atvor.

alter table production_tasks drop constraint production_tasks_product_id_fkey;
alter table production_tasks add constraint production_tasks_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

alter table production_tasks drop constraint production_tasks_assigned_to_fkey;
alter table production_tasks add constraint production_tasks_assigned_to_fkey
  foreign key (assigned_to) references profiles(id) on delete cascade;

alter table orders drop constraint orders_assigned_driver_id_fkey;
alter table orders add constraint orders_assigned_driver_id_fkey
  foreign key (assigned_driver_id) references profiles(id) on delete cascade;

alter table order_items drop constraint order_items_product_id_fkey;
alter table order_items add constraint order_items_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

alter table sales drop constraint sales_cashier_id_fkey;
alter table sales add constraint sales_cashier_id_fkey
  foreign key (cashier_id) references profiles(id) on delete cascade;

alter table sales drop constraint sales_product_id_fkey;
alter table sales add constraint sales_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

alter table production_logs drop constraint production_logs_profile_id_fkey;
alter table production_logs add constraint production_logs_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;

alter table production_logs drop constraint production_logs_product_id_fkey;
alter table production_logs add constraint production_logs_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;
