-- ---------------------------------------------------------------------------
-- Seed data: reference data (country, cities, categories, service types,
-- plans, EV data source) and DEMO businesses for Varna.
--
-- Every demo business has is_demo = true and a name starting with "Демо".
-- The UI labels them as demo listings. Phone numbers use the invalid local
-- prefix "000" (+359 52 000 xxx) so a tap on "call" can never reach a real
-- subscriber, and e-mails use the reserved example.com domain.
--
-- Idempotent: safe to run more than once.
-- ---------------------------------------------------------------------------

begin;

-- Country & cities -----------------------------------------------------------

insert into public.countries (code, name, name_en, default_timezone)
values ('BG', 'България', 'Bulgaria', 'Europe/Sofia')
on conflict (code) do nothing;

insert into public.cities (country_code, name, name_en, slug, center, default_radius_km, is_active, launch_order)
values
  ('BG', 'Варна', 'Varna', 'varna', 'SRID=4326;POINT(27.9147 43.2141)', 20, true, 1),
  ('BG', 'София', 'Sofia', 'sofia', 'SRID=4326;POINT(23.3219 42.6977)', 25, true, 2),
  ('BG', 'Пловдив', 'Plovdiv', 'plovdiv', 'SRID=4326;POINT(24.7453 42.1354)', 20, true, 3),
  ('BG', 'Велико Търново', 'Veliko Tarnovo', 'veliko-tarnovo', 'SRID=4326;POINT(25.6172 43.0757)', 15, true, 4),
  ('BG', 'Бургас', 'Burgas', 'burgas', 'SRID=4326;POINT(27.4626 42.5048)', 20, false, null),
  ('BG', 'Русе', 'Ruse', 'ruse', 'SRID=4326;POINT(25.9657 43.8356)', 15, false, null),
  ('BG', 'Стара Загора', 'Stara Zagora', 'stara-zagora', 'SRID=4326;POINT(25.6345 42.4258)', 15, false, null)
on conflict (slug) do nothing;

-- Categories & service types ------------------------------------------------------

insert into public.categories (slug, kind, name, name_en, description, icon, sort_order)
values
  ('auto-repair', 'business', 'Автосервизи', 'Auto repair', 'Ремонт, диагностика и обслужване на автомобили.', 'wrench', 10),
  ('roadside-assistance', 'roadside', 'Пътна помощ', 'Roadside assistance', 'Репатриране и помощ на пътя.', 'life-buoy', 20),
  ('tire-services', 'business', 'Гуми', 'Tire services', 'Смяна, баланс, ремонт и съхранение на гуми.', 'car', 30),
  ('car-wash', 'business', 'Автомивки', 'Car wash', 'Автоматично, ръчно и самообслужващо измиване.', 'droplets', 40),
  ('car-detailing', 'business', 'Детайлинг', 'Car detailing', 'Полиране, керамика, защитно фолио.', 'sparkles', 50)
on conflict (slug) do nothing;

insert into public.services (category_id, slug, name, name_en, sort_order)
select c.id, s.slug, s.name, s.name_en, s.sort_order
from (values
  ('auto-repair', 'general-repairs', 'Общ ремонт', 'General vehicle repairs', 10),
  ('auto-repair', 'engine-repairs', 'Ремонт на двигател', 'Engine repairs', 20),
  ('auto-repair', 'diagnostics', 'Компютърна диагностика', 'Diagnostics', 30),
  ('auto-repair', 'electrical-repairs', 'Автоелектрика', 'Electrical repairs', 40),
  ('auto-repair', 'oil-and-filter-change', 'Смяна на масло и филтри', 'Oil and filter change', 50),
  ('auto-repair', 'suspension-repairs', 'Ремонт на окачване', 'Suspension repairs', 60),
  ('auto-repair', 'brake-systems', 'Спирачна система', 'Brake systems', 70),
  ('auto-repair', 'air-conditioning', 'Климатична система', 'Air conditioning', 80),
  ('auto-repair', 'transmission-repairs', 'Ремонт на скоростна кутия', 'Transmission repairs', 90),
  ('auto-repair', 'vehicle-inspections', 'Годишен технически преглед', 'Vehicle inspections', 100),

  ('roadside-assistance', 'vehicle-towing', 'Репатриране', 'Vehicle towing', 10),
  ('roadside-assistance', 'emergency-towing', 'Спешно репатриране', 'Emergency towing', 20),
  ('roadside-assistance', 'battery-jump-start', 'Подаване на ток', 'Battery jump-start', 30),
  ('roadside-assistance', 'tire-replacement-roadside', 'Смяна на гума на място', 'Tire replacement', 40),
  ('roadside-assistance', 'fuel-delivery', 'Доставка на гориво', 'Emergency fuel delivery', 50),
  ('roadside-assistance', 'vehicle-transportation', 'Транспорт на автомобил', 'Vehicle transportation', 60),
  ('roadside-assistance', 'ev-transportation', 'Транспорт на електромобил', 'EV transportation', 70),
  ('roadside-assistance', 'roadside-24-7', 'Пътна помощ 24/7', '24/7 roadside assistance', 80),

  ('tire-services', 'tire-replacement', 'Смяна на гуми', 'Tire replacement', 10),
  ('tire-services', 'tire-balancing', 'Баланс', 'Tire balancing', 20),
  ('tire-services', 'tire-repairs', 'Ремонт на гуми', 'Tire repairs', 30),
  ('tire-services', 'seasonal-tire-change', 'Сезонна смяна', 'Seasonal tire change', 40),
  ('tire-services', 'tire-storage', 'Съхранение на гуми', 'Tire storage', 50),
  ('tire-services', 'wheel-alignment', 'Реглаж (геометрия)', 'Wheel alignment', 60),

  ('car-wash', 'automatic-car-wash', 'Автоматична автомивка', 'Automatic car wash', 10),
  ('car-wash', 'self-service-car-wash', 'Автомивка на самообслужване', 'Self-service car wash', 20),
  ('car-wash', 'manual-car-wash', 'Ръчно измиване', 'Manual car wash', 30),
  ('car-wash', 'interior-cleaning', 'Почистване на интериор', 'Interior cleaning', 40),
  ('car-wash', 'upholstery-cleaning', 'Пране на тапицерия', 'Upholstery cleaning', 50),

  ('car-detailing', 'exterior-detailing', 'Външен детайлинг', 'Exterior detailing', 10),
  ('car-detailing', 'interior-detailing', 'Вътрешен детайлинг', 'Interior detailing', 20),
  ('car-detailing', 'paint-correction', 'Корекция на лак', 'Paint correction', 30),
  ('car-detailing', 'ceramic-coating', 'Керамично покритие', 'Ceramic coating', 40),
  ('car-detailing', 'paint-protection-film', 'Защитно фолио (PPF)', 'Paint protection film', 50),
  ('car-detailing', 'headlight-restoration', 'Възстановяване на фарове', 'Headlight restoration', 60)
) as s (category_slug, slug, name, name_en, sort_order)
join public.categories c on c.slug = s.category_slug
on conflict (category_id, slug) do nothing;

-- Subscription plans (initial product assumptions) --------------------------------

insert into public.subscription_plans (code, name, description, price_cents, placement_weight, sort_order)
values
  ('starter', 'Starter', 'Бизнес профил с основна информация.', 999, 0, 10),
  ('professional', 'Professional', 'Неограничени услуги, онлайн резервации и статистика.', 1999, 0, 20),
  ('premium', 'Premium', 'Приоритетно позициониране и разширен профил.', 3999, 100, 30)
on conflict (code) do nothing;

insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, f.feature_key, f.enabled, f.limit_value
from (values
  ('starter', 'max_services', true, 5),
  ('starter', 'max_images', true, 5),
  ('starter', 'online_booking', false, null),
  ('starter', 'extended_stats', false, null),
  ('starter', 'priority_placement', false, null),
  ('starter', 'enhanced_profile', false, null),
  ('starter', 'max_locations', true, 1),
  ('starter', 'max_team_members', true, 2),

  ('professional', 'max_services', true, null),
  ('professional', 'max_images', true, 20),
  ('professional', 'online_booking', true, null),
  ('professional', 'extended_stats', true, null),
  ('professional', 'priority_placement', false, null),
  ('professional', 'enhanced_profile', false, null),
  ('professional', 'max_locations', true, 3),
  ('professional', 'max_team_members', true, 10),

  ('premium', 'max_services', true, null),
  ('premium', 'max_images', true, 50),
  ('premium', 'online_booking', true, null),
  ('premium', 'extended_stats', true, null),
  ('premium', 'priority_placement', true, null),
  ('premium', 'enhanced_profile', true, null),
  ('premium', 'max_locations', true, 10),
  ('premium', 'max_team_members', true, null)
) as f (plan_code, feature_key, enabled, limit_value)
join public.subscription_plans p on p.code = f.plan_code
on conflict (plan_id, feature_key) do nothing;

-- EV data source -------------------------------------------------------------------

insert into public.charging_data_sources (code, name, website, license, attribution)
values (
  'open_charge_map',
  'Open Charge Map',
  'https://openchargemap.org',
  'CC BY 4.0 (user contributions); imported third-party data remains under its provider''s licence',
  'Данни за зарядни станции: © Open Charge Map и сътрудници'
)
on conflict (code) do nothing;

insert into public.platform_settings (key, value, description)
values
  ('booking.default_lead_hours', '2', 'Default minimum notice for new bookings (hours).'),
  ('roadside.default_radius_km', '30', 'Default coverage radius for new roadside providers (km).')
on conflict (key) do nothing;

-- Demo businesses (Varna) ----------------------------------------------------------

create temporary table demo_business (
  slug text primary key,
  category_slug text not null,
  name text not null,
  description text not null,
  phone text not null,
  address text not null,
  lng double precision not null,
  lat double precision not null,
  is_24_7 boolean not null default false,
  coverage_km numeric,
  booking boolean not null default false,
  capacity smallint not null default 1,
  services text[] not null
) on commit drop;

insert into demo_business values
  ('demo-avtoservis-vladislav', 'auto-repair', 'Демо Автосервиз Владислав',
   'Демо обява. Общ ремонт, диагностика и обслужване на леки автомобили.',
   '+359 52 000 101', 'бул. „Владислав Варненчик“ 250, Варна', 27.8690, 43.2235, false, null, true, 3,
   array['general-repairs', 'diagnostics', 'oil-and-filter-change', 'brake-systems', 'suspension-repairs']),
  ('demo-motor-expert-mladost', 'auto-repair', 'Демо Мотор Експерт',
   'Демо обява. Ремонт на двигатели и скоростни кутии, автоелектрика.',
   '+359 52 000 102', 'ж.к. „Младост“, Варна', 27.8850, 43.2210, false, null, false, 1,
   array['engine-repairs', 'transmission-repairs', 'electrical-repairs', 'diagnostics']),
  ('demo-klimatik-servis-chayka', 'auto-repair', 'Демо Климатик Сервиз Чайка',
   'Демо обява. Зареждане и ремонт на автоклиматици, диагностика.',
   '+359 52 000 103', 'ж.к. „Чайка“, Варна', 27.9310, 43.2280, false, null, true, 2,
   array['air-conditioning', 'diagnostics', 'electrical-repairs']),
  ('demo-gumi-asparuhovo', 'tire-services', 'Демо Гуми Аспарухово',
   'Демо обява. Сезонна смяна, баланс и хотел за гуми.',
   '+359 52 000 104', 'кв. „Аспарухово“, Варна', 27.8980, 43.1840, false, null, true, 2,
   array['tire-replacement', 'tire-balancing', 'seasonal-tire-change', 'tire-storage']),
  ('demo-geometria-centar', 'tire-services', 'Демо Геометрия Център',
   'Демо обява. Реглаж, ремонт на гуми и джанти.',
   '+359 52 000 105', 'бул. „Сливница“, Варна', 27.9100, 43.2090, false, null, false, 1,
   array['wheel-alignment', 'tire-repairs', 'tire-replacement']),
  ('demo-avtomivka-primorski', 'car-wash', 'Демо Автомивка Приморски',
   'Демо обява. Ръчно измиване и почистване на интериор.',
   '+359 52 000 106', 'бул. „Приморски“, Варна', 27.9250, 43.2060, false, null, true, 2,
   array['manual-car-wash', 'interior-cleaning', 'upholstery-cleaning']),
  ('demo-samoobsluzhvane-levski', 'car-wash', 'Демо Самообслужване Левски',
   'Демо обява. Автомивка на самообслужване, отворена денонощно.',
   '+359 52 000 107', 'ж.к. „Левски“, Варна', 27.9020, 43.2230, true, null, false, 4,
   array['self-service-car-wash']),
  ('demo-detailing-studio-briz', 'car-detailing', 'Демо Детайлинг Студио Бриз',
   'Демо обява. Корекция на лак, керамични покрития и PPF фолио.',
   '+359 52 000 108', 'кв. „Бриз“, Варна', 27.9450, 43.2160, false, null, true, 1,
   array['paint-correction', 'ceramic-coating', 'paint-protection-film', 'headlight-restoration']),
  ('demo-patna-pomosht-varna-24', 'roadside-assistance', 'Демо Пътна помощ Варна 24',
   'Демо обява. Репатриране, подаване на ток и смяна на гума 24/7.',
   '+359 52 000 109', 'Западна промишлена зона, Варна', 27.8420, 43.2050, true, 40, false, 1,
   array['vehicle-towing', 'emergency-towing', 'battery-jump-start', 'tire-replacement-roadside', 'roadside-24-7']),
  ('demo-ev-transport-devnya', 'roadside-assistance', 'Демо EV Транспорт',
   'Демо обява. Транспорт на електромобили и автомобили с платформа.',
   '+359 52 000 110', 'кв. „Владиславово“, Варна', 27.8520, 43.2330, false, 80, false, 1,
   array['vehicle-transportation', 'ev-transportation', 'vehicle-towing', 'fuel-delivery'])
;

insert into public.businesses (
  slug, city_id, primary_category_id, name, description, phone, email,
  status, approved_at, is_demo, booking_enabled, booking_slot_minutes, created_by
)
select
  d.slug,
  (select id from public.cities where slug = 'varna'),
  c.id,
  d.name,
  d.description,
  d.phone,
  d.slug || '@example.com',
  'approved',
  now(),
  true,
  d.booking,
  30,
  null
from demo_business d
join public.categories c on c.slug = d.category_slug
on conflict (city_id, slug) do nothing;

insert into public.business_locations (
  business_id, city_id, address_line, location, is_primary, capacity, is_24_7,
  hours_verified_at, coverage_radius_km
)
select
  b.id, b.city_id, d.address,
  extensions.st_setsrid(extensions.st_makepoint(d.lng, d.lat), 4326)::extensions.geography,
  true, d.capacity, d.is_24_7, now(), d.coverage_km
from demo_business d
join public.businesses b on b.slug = d.slug and b.is_demo
where not exists (select 1 from public.business_locations l where l.business_id = b.id);

-- Working hours: Mon–Fri 08:30–18:00, Sat 09:00–14:00 (not for 24/7 locations).
insert into public.business_hours (business_location_id, weekday, opens_at, closes_at)
select l.id, w.weekday, w.opens_at, w.closes_at
from public.business_locations l
join public.businesses b on b.id = l.business_id and b.is_demo
cross join (values
  (1, time '08:30', time '18:00'), (2, '08:30', '18:00'), (3, '08:30', '18:00'),
  (4, '08:30', '18:00'), (5, '08:30', '18:00'), (6, '09:00', '14:00')
) as w (weekday, opens_at, closes_at)
where not l.is_24_7
  and not exists (select 1 from public.business_hours h where h.business_location_id = l.id);

-- Booking availability mirrors working hours for booking-enabled demo businesses.
insert into public.availability_rules (business_location_id, weekday, start_time, end_time)
select h.business_location_id, h.weekday, h.opens_at, h.closes_at
from public.business_hours h
join public.business_locations l on l.id = h.business_location_id
join public.businesses b on b.id = l.business_id and b.is_demo and b.booking_enabled
where not exists (select 1 from public.availability_rules r where r.business_location_id = h.business_location_id);

-- Offered services with indicative demo prices.
insert into public.business_services (
  business_id, service_id, name, price_from_cents, duration_minutes, is_bookable, sort_order
)
select
  b.id,
  s.id,
  s.name,
  case s.slug
    when 'oil-and-filter-change' then 4000
    when 'diagnostics' then 3000
    when 'brake-systems' then 6000
    when 'air-conditioning' then 5000
    when 'seasonal-tire-change' then 4000
    when 'tire-balancing' then 2000
    when 'wheel-alignment' then 4000
    when 'manual-car-wash' then 1500
    when 'interior-cleaning' then 3000
    when 'ceramic-coating' then 40000
    when 'paint-correction' then 25000
    else null
  end,
  case
    when s.slug in ('ceramic-coating', 'paint-correction', 'paint-protection-film') then 240
    when s.slug in ('engine-repairs', 'transmission-repairs', 'general-repairs') then 120
    else 60
  end,
  b.booking_enabled,
  ord.n
from demo_business d
join public.businesses b on b.slug = d.slug and b.is_demo
cross join lateral unnest(d.services) with ordinality as ord (service_slug, n)
join public.services s on s.slug = ord.service_slug
where not exists (
  select 1 from public.business_services bs where bs.business_id = b.id and bs.service_id = s.id
);

-- Roadside coverage: whole Varna city plus radius around the base.
insert into public.service_areas (business_location_id, city_id, label)
select l.id, l.city_id, 'Варна'
from public.business_locations l
join public.businesses b on b.id = l.business_id and b.is_demo
join public.categories c on c.id = b.primary_category_id and c.slug = 'roadside-assistance'
where not exists (select 1 from public.service_areas a where a.business_location_id = l.id);

commit;
