# B1sTeam Locket — Frame Assets (tocams.xyz/khung.html community gallery)

Nguồn: **Gallery Mẫu Khung Cộng Đồng** tại `https://tocams.xyz/khung.html`
(API `GET https://tocams.xyz/api/frame/gallery` — 135 frame + 7 frame Kawaii gốc = 142).
Tất cả đã được tải về, loại nền, kiểm định và đổi tên theo nội dung khung.

## Tổng quan

| Chỉ số | Giá trị |
|---|---|
| Frame gốc trong gallery | 142 |
| Frame trong bộ này | 132 (gồm 13 file photobooth khôi phục) |
| Loại: ảnh người thật / quảng cáo / không phải khung / không tách nền được | 20 |
| Trùng sha256 | 3 (giữ 1 bản) |
| Dung lượng | 110.5 MB |
| Đuôi file | 100%% PNG (tất cả có kênh alpha) |
| Đa số độ phân giải | 1080x1080 ×56, 1254x1254 ×24, 640x640 ×20, 2048x2048 ×13 |
| Nguồn | raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/ |

## Đặt tên

Mọi file đều có tiền tố `b1s_locketvip_` và tên mô tả nội dung khung:
vd. `b1s_locketvip_shinchan_neon.png`, `b1s_locketvip_hello_kitty_hearts_pink.png`,
`b1s_locketvip_dragon_ball.png`, `b1s_locketvip_detective_conan.png`.
Cùng 1 thiết kế được upload nhiều lần trong gallery → giữ tất cả bản (không xoá thinh lặng);
bản trùng hoàn toàn (sha256 giống hệt) bị bỏ 3 file.

## Những frame bị LOẠI (20) — không phù hợp hoặc không phải khungLocket

| # | Tên gốc (API) | Lý do loại |
|---|---|---|
| 002 | `chiu 👑` | Khung Argentina + ảnh cầu thủ thật |
| 025 | `frame` | Scrapbook collage 2 ơ ảnh + nền sóng toàn cảnh |
| 027 | `IMG_4970` | Ảnh thờ/bàn thờ |
| 029 | `IMG_2283` | Nền hồng phẳng — không tách được (remove.bg fail, flood-fill fail) |
| 030 | `IMG_2636` | Ảnh chân dung người thật |
| 031 | `IMG_6734` | Collage logo (MTV + người leo núi) |
| 032 | `chiu 👑` | Khung Argentina + ảnh cầu thủ thật (giống 002) |
| 051 | `CAFB1DC2-3F3B-42B9-829D-DBA267779FF7` | Ultraman + 4 ảnh người thật |
| 052 | `233d09fe-5a10-45d5-885e-2149e02c1b76` | Collage có ảnh người thật |
| 058 | `60C590AE-4552-477F-8003-B8A92C17010F` | Quảng cáo 'DinhKhoi Media' + số điện thoại |
| 063 | `@emninh` | Khung MIXI — Misthy (người thật) |
| 066 | `IMG_0788` | Scrapbook ảnh người thật |
| 067 | `IMG_6304` | Khung MIXI — ảnh người thật |
| 081 | `Duy Khánh` | Khung 'Duy Khánh' + 4 ảnh người thật |
| 082 | `IMG_4594` | Khung 'Siêu Bá Khi' + ảnh người thật |
| 094 | `@frval` | Khung MESSI GOAT — Lionel Messi (người thật) |
| 095 | `Gemini_Generated_Image_yd2juuyd2juuyd2j-` | Khung MESSI GOAT — Lionel Messi (người thật) |
| 105 | `Gemini_Generated_Image_yd2juuyd2juuyd2j-` | Khung MESSI GOAT — giống 095 (Lionel Messi, người thật) |
| 130 | `6402DB98-9CFA-4379-BE2E-135E15DF5E01` | Khung CR7 'Hoàng Cris' — Cristiano Ronaldo (người thật) |
| 131 | `F90BFECD-D6B5-426A-ACA5-21E73D6A277E` | Khung CR7 'Hoàng Cris' — ảnh người thật (trùng design 130) |

## Những frame cần xử lý nền (công cụ đã dùng)

| File | Công cụ | Kết quả |
|---|---|---|
| `b1s_locketvip_shinchan_neon.png` (1254×1254) | Flood-fill cục bộ (remove.bg báo `unknown_foreground`) | Nền đen → trong suốt 100%% ở vùng trung tâm |
| `b1s_locketvip_my_melody_plaid_hearts.png` (500×500) | **remove.bg** (preview tier — gói hiện tại size=full trả 402) | Plaid đen → trong suốt 57%% |
| `b1s_locketvip_hello_kitty_hearts_pink_2.png` (500×500) | **remove.bg** (preview tier) | Nền đen → trong suốt 64%% |
| `b1s_locketvip_hello_kitty_hearts_pink_3.png` (500×500) | **remove.bg** (preview tier) | Nền trắng → trong suốt 64%% |
| `b1s_locketvip_img_0837_removebg_preview.png` (500×500) | Upload sẵn 'removebg-preview' của tác giả gốc, giữ nguyên | Tia lửa thưa, nền trong |

## Frames khôi phục từ dòng photobooth (13) — được camera_filter_config.json tham chiếu

13 file gốc photobooth/khung đã được khôi phục vào `assets/rc/frames/` do `camera_filter_config.json`
vẫn trỏ tới chúng (21 refs mỗi file — 273 refs). Các refs tới 14 file cũ dạng `frame_*`/`pb_*`
đã được remap sang frame mới gần nhất về nội dung (294 refs). Không còn URL chết nào.

## Bảng frames (132)

| File | Kích thước | Bytes | sha12 | URL |
|---|---|---|---|---|
| `b1s_locketvip_anime_crew_blue.png` | 1254x1254 | 1593935 | a34665f2427e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_anime_crew_blue.png) |
| `b1s_locketvip_anime_ice_princess.png` | 640x640 | 130616 | 6bd965834d10 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_anime_ice_princess.png) |
| `b1s_locketvip_anime_warriors_quocduy.png` | 500x500 | 311077 | ec677c2287e6 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_anime_warriors_quocduy.png) |
| `b1s_locketvip_attack_on_titan.png` | 640x640 | 356267 | 699c9d125ef0 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_attack_on_titan.png) |
| `b1s_locketvip_banana_border.png` | 1080x1080 | 896918 | 241ba56ddf08 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_banana_border.png) |
| `b1s_locketvip_be_meo_gau_nau_panda_cau_vong_pastel.png` | 1080x1080 | 883254 | 41d9c28b7eb1 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_be_meo_gau_nau_panda_cau_vong_pastel.png) |
| `b1s_locketvip_be_meo_gau_nau_panda_cau_vong_pastel_2.png` | 1080x1080 | 998060 | 525ac483babe | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_be_meo_gau_nau_panda_cau_vong_pastel_2.png) |
| `b1s_locketvip_bear_babies_brown.png` | 1080x1080 | 736309 | ea7ade04db08 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_bear_babies_brown.png) |
| `b1s_locketvip_bear_babies_brown_2.png` | 3464x3464 | 5537165 | 8ec8aa9bdae9 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_bear_babies_brown_2.png) |
| `b1s_locketvip_bikini_bottom_cartoon_frame.png` | 1024x1024 | 1988218 | 6b68ec846942 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_bikini_bottom_cartoon_frame.png) |
| `b1s_locketvip_bikini_bottom_cartoon_frame_2.png` | 1080x1080 | 1288945 | 468681a96793 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_bikini_bottom_cartoon_frame_2.png) |
| `b1s_locketvip_bikini_bottom_cartoon_frame_3.png` | 1080x1080 | 1268138 | dcb83e4cf7db | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_bikini_bottom_cartoon_frame_3.png) |
| `b1s_locketvip_bikini_bottom_cartoon_frame_4.png` | 1080x1080 | 1348030 | 3ba681136746 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_bikini_bottom_cartoon_frame_4.png) |
| `b1s_locketvip_birthday_bunny_cloud.png` | 1254x1254 | 1011864 | 61d583201785 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_birthday_bunny_cloud.png) |
| `b1s_locketvip_black_butler.png` | 640x640 | 395508 | 8fb10be85a44 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_black_butler.png) |
| `b1s_locketvip_bunny_birthday_white.png` | 1080x1080 | 822839 | 403a006fe7a8 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_bunny_birthday_white.png) |
| `b1s_locketvip_cinnamoroll_bunnies.png` | 1080x1080 | 539526 | f141f7a556a0 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cinnamoroll_bunnies.png) |
| `b1s_locketvip_cinnamoroll_frame.png` | 640x640 | 220231 | 0611dfddb367 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cinnamoroll_frame.png) |
| `b1s_locketvip_cinnamoroll_pastel.png` | 1080x1080 | 936175 | 2738b11942f2 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cinnamoroll_pastel.png) |
| `b1s_locketvip_cinnamoroll_pastel_2.png` | 1080x1080 | 910525 | c730e15f9d23 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cinnamoroll_pastel_2.png) |
| `b1s_locketvip_cinnamoroll_pastel_4.png` | 1080x1080 | 819675 | 2eb45e932f71 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cinnamoroll_pastel_4.png) |
| `b1s_locketvip_cinnamoroll_pastel_5.png` | 1080x1080 | 997949 | b2c4a2a81ee9 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cinnamoroll_pastel_5.png) |
| `b1s_locketvip_cinnamoroll_pastel_6.png` | 1080x1080 | 961879 | 24f00aff2471 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cinnamoroll_pastel_6.png) |
| `b1s_locketvip_clb_meac_6_birthday.png` | 1231x1277 | 1153505 | 562f956fa1db | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_clb_meac_6_birthday.png) |
| `b1s_locketvip_corgi_panda_khung_long_no_hong.png` | 1254x1254 | 1785729 | e98dafb39517 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_corgi_panda_khung_long_no_hong.png) |
| `b1s_locketvip_cun_corgi_panda_be_khung_long_no_hong.png` | 1080x1080 | 612061 | 648d52e3a479 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cun_corgi_panda_be_khung_long_no_hong.png) |
| `b1s_locketvip_cun_corgi_panda_be_khung_long_no_hong_2.png` | 1080x1080 | 447469 | 9146c87c908d | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cun_corgi_panda_be_khung_long_no_hong_2.png) |
| `b1s_locketvip_cun_corgi_panda_be_khung_long_no_hong_3.png` | 1080x1080 | 763086 | 1dd79f418f06 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cun_corgi_panda_be_khung_long_no_hong_3.png) |
| `b1s_locketvip_cyberpunk_skull_neon.png` | 640x640 | 603885 | 59de8d912bc3 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_cyberpunk_skull_neon.png) |
| `b1s_locketvip_detective_conan.png` | 640x640 | 368600 | b9b8cf2fa732 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_detective_conan.png) |
| `b1s_locketvip_detective_conan_kaitou_kid.png` | 1254x1254 | 2524763 | 2e935265c46e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_detective_conan_kaitou_kid.png) |
| `b1s_locketvip_detective_conan_kaitou_kid_full.png` | 1080x1080 | 1996484 | d3b44bc924da | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_detective_conan_kaitou_kid_full.png) |
| `b1s_locketvip_doraemon.png` | 640x640 | 308915 | 3ae66fa5add5 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_doraemon.png) |
| `b1s_locketvip_doraemon_besties.png` | 1080x1080 | 1115526 | 24641373a14e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_doraemon_besties.png) |
| `b1s_locketvip_doraemon_besties_2.png` | 1254x1254 | 1339506 | caeb763fc423 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_doraemon_besties_2.png) |
| `b1s_locketvip_doraemon_besties_3.png` | 1080x1080 | 1057853 | db664be835af | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_doraemon_besties_3.png) |
| `b1s_locketvip_dragon_ball.png` | 640x640 | 379600 | ef0caad60329 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_dragon_ball.png) |
| `b1s_locketvip_dragon_hoduc.png` | 1254x1254 | 1797899 | 49ed9577a406 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_dragon_hoduc.png) |
| `b1s_locketvip_dragonball_quocduy.png` | 500x500 | 417312 | 3a767b35e64c | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_dragonball_quocduy.png) |
| `b1s_locketvip_dragonball_rainbow.png` | 1080x1080 | 1448006 | 82ecf7bf9277 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_dragonball_rainbow.png) |
| `b1s_locketvip_forest_spirit_cat.png` | 640x640 | 314577 | d2aaac78643e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_forest_spirit_cat.png) |
| `b1s_locketvip_free_fire_booyah.png` | 1080x1080 | 1520174 | 679d636d3f8d | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_free_fire_booyah.png) |
| `b1s_locketvip_free_fire_booyah_2.png` | 1080x1080 | 1005243 | a73da1867d8a | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_free_fire_booyah_2.png) |
| `b1s_locketvip_free_fire_booyah_3.png` | 1080x1080 | 1623640 | a077cb2f9fd3 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_free_fire_booyah_3.png) |
| `b1s_locketvip_free_fire_booyah_4.png` | 1080x1080 | 1446378 | 898a39572207 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_free_fire_booyah_4.png) |
| `b1s_locketvip_frieren_ice.png` | 1080x1080 | 1501643 | 663369122160 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_frieren_ice.png) |
| `b1s_locketvip_frieren_ice_2.png` | 1080x1080 | 1346129 | cab6de4ce54b | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_frieren_ice_2.png) |
| `b1s_locketvip_frieren_ice_3.png` | 500x500 | 382009 | 9a4860904b20 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_frieren_ice_3.png) |
| `b1s_locketvip_hello_kitty_dotted_pink.png` | 1080x1080 | 663670 | 3324acb38585 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_dotted_pink.png) |
| `b1s_locketvip_hello_kitty_flowers.png` | 1080x1080 | 981488 | 3d85a4bb39fd | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_flowers.png) |
| `b1s_locketvip_hello_kitty_flowers_2.png` | 1080x1080 | 935983 | 9f52fd2de0e4 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_flowers_2.png) |
| `b1s_locketvip_hello_kitty_flowers_3.png` | 1080x1080 | 955424 | fc1fffe882bc | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_flowers_3.png) |
| `b1s_locketvip_hello_kitty_flowers_4.png` | 1080x1080 | 1000834 | 8d306a2c6c98 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_flowers_4.png) |
| `b1s_locketvip_hello_kitty_flowers_5.png` | 640x640 | 339512 | a6c6b0325fb2 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_flowers_5.png) |
| `b1s_locketvip_hello_kitty_hearts_pink.png` | 1254x1254 | 1229113 | 30ea479f2c14 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_hearts_pink.png) |
| `b1s_locketvip_hello_kitty_hearts_pink_2.png` | 500x500 | 252454 | 9d3f5769f921 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_hearts_pink_2.png) |
| `b1s_locketvip_hello_kitty_hearts_pink_3.png` | 500x500 | 238151 | 6aaa4d8a8d24 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_hearts_pink_3.png) |
| `b1s_locketvip_hello_kitty_party_pink.png` | 1254x1254 | 1560139 | ca79b6aa5ed2 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_party_pink.png) |
| `b1s_locketvip_hello_kitty_sakura_rainbow.png` | 1080x1080 | 901973 | 2ce572716ecb | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hello_kitty_sakura_rainbow.png) |
| `b1s_locketvip_hoa_anh_dao_sakura_tho_meo_cong_torii.png` | 1080x1080 | 615102 | 46c213d31c4b | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hoa_anh_dao_sakura_tho_meo_cong_torii.png) |
| `b1s_locketvip_hoa_anh_dao_sakura_tho_meo_cong_torii_2.png` | 1080x1080 | 1005171 | 692e064dd21e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hoa_anh_dao_sakura_tho_meo_cong_torii_2.png) |
| `b1s_locketvip_houses_cartoon_border.png` | 1080x1080 | 1397202 | 651d0582d183 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_houses_cartoon_border.png) |
| `b1s_locketvip_houses_cartoon_border_2.png` | 600x600 | 548096 | 0719bb8692a9 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_houses_cartoon_border_2.png) |
| `b1s_locketvip_hunter_x_hunter.png` | 640x640 | 344446 | e05bfba5196d | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hunter_x_hunter.png) |
| `b1s_locketvip_hunter_x_hunter_killua.png` | 1080x1080 | 1241593 | a0b33f32a64e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hunter_x_hunter_killua.png) |
| `b1s_locketvip_hunter_x_hunter_killua_2.png` | 1080x1080 | 1301537 | 5d2df96181f9 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_hunter_x_hunter_killua_2.png) |
| `b1s_locketvip_instagram_comment_candy.png` | 1254x1254 | 638386 | c08ba29af689 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_instagram_comment_candy.png) |
| `b1s_locketvip_instagram_comment_pink.png` | 1254x1254 | 337002 | 2a60fcd5a5d2 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_instagram_comment_pink.png) |
| `b1s_locketvip_instagram_comment_sunset.png` | 828x828 | 437027 | b8965c71da87 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_instagram_comment_sunset.png) |
| `b1s_locketvip_instagram_comment_sunset_2.png` | 828x828 | 365253 | edbb6eddada8 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_instagram_comment_sunset_2.png) |
| `b1s_locketvip_instagram_comment_sunset_3.png` | 1080x1080 | 412015 | 89d38ec91a85 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_instagram_comment_sunset_3.png) |
| `b1s_locketvip_kawaii_animals_pastel.png` | 640x640 | 193313 | 5409cfd9b458 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_kawaii_animals_pastel.png) |
| `b1s_locketvip_kawaii_banana_border_frame.png` | 1247x1261 | 1020282 | a4356d16c3d9 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_kawaii_banana_border_frame.png) |
| `b1s_locketvip_kawaii_piggy_pastel_frame.png` | 1254x1254 | 972586 | 518ec8b04c35 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_kawaii_piggy_pastel_frame.png) |
| `b1s_locketvip_kawaii_pink_bunny_heart_frame.png` | 1254x1254 | 1060764 | d992df6c637e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_kawaii_pink_bunny_heart_frame.png) |
| `b1s_locketvip_kawaii_space_themed_boys_frame.png` | 1080x1080 | 1198070 | be70c21db3c8 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_kawaii_space_themed_boys_frame.png) |
| `b1s_locketvip_kawaii_space_themed_boys_frame_2.png` | 1080x1080 | 1258865 | 83311b3ddeac | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_kawaii_space_themed_boys_frame_2.png) |
| `b1s_locketvip_kawaii_space_themed_boys_frame_3.png` | 1254x1254 | 1503731 | a0087ceaa5f1 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_kawaii_space_themed_boys_frame_3.png) |
| `b1s_locketvip_locket_gold_ultra_nguyen_quoc.png` | 600x600 | 410397 | 5bbc1a2a349d | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_locket_gold_ultra_nguyen_quoc.png) |
| `b1s_locketvip_locket_pastel_kitty_shinchan.png` | 1254x1254 | 1083236 | 7c8d0d2b21f9 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_locket_pastel_kitty_shinchan.png) |
| `b1s_locketvip_luffy_gear5.png` | 1080x1080 | 1497747 | 82fce31310f0 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_luffy_gear5.png) |
| `b1s_locketvip_melody_skull_pink.png` | 1080x1080 | 1105709 | 5fc6152b4cef | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_melody_skull_pink.png) |
| `b1s_locketvip_meo_gau_panda_cau_vong_pastel.png` | 1254x1254 | 1222510 | d5abd1f9f245 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_meo_gau_panda_cau_vong_pastel.png) |
| `b1s_locketvip_my_hero_academia.png` | 640x640 | 525173 | c4db93db3899 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_my_hero_academia.png) |
| `b1s_locketvip_my_melody_plaid_hearts.png` | 500x500 | 277064 | 818cbca9e99c | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_my_melody_plaid_hearts.png) |
| `b1s_locketvip_naruto.png` | 640x640 | 335367 | 74cad0931d09 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_naruto.png) |
| `b1s_locketvip_neko_cat_frame.png` | 640x640 | 349666 | dc686c3d4675 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_neko_cat_frame.png) |
| `b1s_locketvip_one_piece.png` | 640x640 | 337887 | 8792664189d7 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_one_piece.png) |
| `b1s_locketvip_one_piece_gears.png` | 1080x1080 | 1425110 | b3c23ec144cc | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_one_piece_gears.png) |
| `b1s_locketvip_one_piece_gears_2.png` | 600x600 | 559462 | d7935f52f88e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_one_piece_gears_2.png) |
| `b1s_locketvip_one_punch_man.png` | 640x640 | 487101 | c403db8225fb | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_one_punch_man.png) |
| `b1s_locketvip_ornate_vintage_babies.png` | 640x640 | 528351 | 7082f148e498 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_ornate_vintage_babies.png) |
| `b1s_locketvip_pigs_cats_nguyen_tai.png` | 1254x1254 | 1154895 | db66f7e71511 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_pigs_cats_nguyen_tai.png) |
| `b1s_locketvip_pokemon.png` | 640x640 | 331257 | ba0cec026b26 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_pokemon.png) |
| `b1s_locketvip_rainbow_arc_kids.png` | 377x376 | 87409 | 1e5997ed264e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_rainbow_arc_kids.png) |
| `b1s_locketvip_red_metallic_v_frame.png` | 1080x1080 | 490586 | e2b587395cef | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_red_metallic_v_frame.png) |
| `b1s_locketvip_sailor_moon.png` | 640x640 | 389246 | cb913e903464 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_sailor_moon.png) |
| `b1s_locketvip_sakura_tho_meo_torii.png` | 1254x1254 | 1956482 | ec8c1546bed2 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_sakura_tho_meo_torii.png) |
| `b1s_locketvip_shin_chan_ngay_nghi_khung_long_xanh.png` | 1080x1080 | 603203 | fe2316e06691 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shin_chan_ngay_nghi_khung_long_xanh.png) |
| `b1s_locketvip_shin_chan_ngay_nghi_khung_long_xanh_2.png` | 1080x1080 | 816405 | e48189ee60c0 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shin_chan_ngay_nghi_khung_long_xanh_2.png) |
| `b1s_locketvip_shin_chan_rainbow_sticker_frame.png` | 1254x1254 | 1388334 | 0be84ba41c72 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shin_chan_rainbow_sticker_frame.png) |
| `b1s_locketvip_shinchan_action_mask.png` | 1254x1254 | 869275 | 3d65deb20fa4 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_action_mask.png) |
| `b1s_locketvip_shinchan_collage.png` | 1080x1080 | 927426 | 722926c577bf | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_collage.png) |
| `b1s_locketvip_shinchan_crayon_cream.png` | 1080x1080 | 1052975 | 80a201a8347e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_crayon_cream.png) |
| `b1s_locketvip_shinchan_crayon_cream_2.png` | 1080x1080 | 1232431 | 12fb6a91037c | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_crayon_cream_2.png) |
| `b1s_locketvip_shinchan_family_frame.png` | 1024x1024 | 878311 | df8de1be1fbe | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_family_frame.png) |
| `b1s_locketvip_shinchan_friends.png` | 1080x1080 | 468922 | f92399c5b420 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_friends.png) |
| `b1s_locketvip_shinchan_neon.png` | 1254x1254 | 1717766 | 95cc3ec76f18 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_neon.png) |
| `b1s_locketvip_shinchan_ngay_nghi_khung_long.png` | 1254x1254 | 1983749 | f0d465962672 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_ngay_nghi_khung_long.png) |
| `b1s_locketvip_shinchan_nguyen_vinh.png` | 1254x1254 | 1148883 | edd36dd2b0b7 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_nguyen_vinh.png) |
| `b1s_locketvip_shinchan_quocduy.png` | 490x479 | 536112 | a87e6abe2700 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_quocduy.png) |
| `b1s_locketvip_shinchan_rainbow_pastel.png` | 1080x1080 | 1144193 | 01672d963350 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_rainbow_pastel.png) |
| `b1s_locketvip_shinchan_soccer_cars.png` | 1080x1080 | 1010578 | 95a59020adf4 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_soccer_cars.png) |
| `b1s_locketvip_shinchan_soccer_cars_2.png` | 1080x1080 | 1012993 | aadbcbbd6d90 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_soccer_cars_2.png) |
| `b1s_locketvip_shinchan_stripe_stars.png` | 1080x1080 | 684974 | 82ecd044bae9 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_stripe_stars.png) |
| `b1s_locketvip_sparkle_vines_border.png` | 500x500 | 194882 | 4b94434cfb90 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_sparkle_vines_border.png) |
| `b1s_locketvip_spongebob_bikini_bottom.png` | 1080x1080 | 1370977 | 6e16e3a0d4ea | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_spongebob_bikini_bottom.png) |
| `b1s_locketvip_the_gioi_kawaii_tho_gau.png` | 1254x1254 | 1766787 | 1707d31b85ee | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_the_gioi_kawaii_tho_gau.png) |
| `b1s_locketvip_tho_gau_nau_tra_sua.png` | 1254x1254 | 1874464 | 98881a34f12a | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_tho_gau_nau_tra_sua.png) |
| `frame_berry_days.png` | 2048x2048 | 92723 | 06f7b966059e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/frame_berry_days.png) |
| `frame_classic_pb.png` | 2048x2048 | 75284 | 1a4becfd7e84 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/frame_classic_pb.png) |
| `frame_happy_snap.png` | 2048x2048 | 99326 | c2053c4e53e7 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/frame_happy_snap.png) |
| `frame_sky_diary.png` | 2048x2048 | 201942 | bfcd14f50a99 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/frame_sky_diary.png) |
| `pb_denim_ripped_2x2.png` | 2048x2048 | 96628 | 21c3f3a6d5a5 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/pb_denim_ripped_2x2.png) |
| `pb_holo_4cut.png` | 2048x2048 | 311571 | 250ea36f3822 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/pb_holo_4cut.png) |
| `pb_ripped_paper_4cut.png` | 2048x2048 | 89561 | d5f7ee2be29c | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/pb_ripped_paper_4cut.png) |
| `pb_scrapbook_ripped_4cut.png` | 2048x2048 | 103286 | 32fa99c655ba | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/pb_scrapbook_ripped_4cut.png) |
| `pb_single_denim_ripped.png` | 2048x2048 | 79787 | 698b7fd40b7e | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/pb_single_denim_ripped.png) |
| `pb_single_film_nostalgia.png` | 2048x2048 | 52808 | a4304ee5e245 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/pb_single_film_nostalgia.png) |
| `pb_single_y2k_silver_holo.png` | 2048x2048 | 82719 | a893b944cd6b | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/pb_single_y2k_silver_holo.png) |
| `photobooth_4cut.png` | 2048x2048 | 72524 | 18b3b432cfa1 | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/photobooth_4cut.png) |
| `photobooth_cute.png` | 2048x2048 | 101519 | 2d89f4d1f67a | [raw](https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/photobooth_cute.png) |

## Nguồn dữ liệu

- items.json (gốc API): 122 frame — 99 URL nodns.vn, 20 embedded base64, 6 kawaii gốc
- Danh sách reject/dupe nằm trong `assets/rc/manifest.json`
- Lưu ý: ảnh do cộng đồng upload, bản quyền thuộc về tác giả gốc; B1sTeam chỉ distribute lại qua repo công khai.
- Reject có lý do rõ ràng (ảnh người thật / quảng cáo / không phải khung / nền không tách được); khôi phục theo idx nếu cần.

*Generated 2026-11-15*