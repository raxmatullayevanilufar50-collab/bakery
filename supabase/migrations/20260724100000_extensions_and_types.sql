-- Kengaytmalar va enum turlari

create extension if not exists pgcrypto;

create type user_role as enum ('owner', 'manager', 'baker', 'driver', 'cashier');
