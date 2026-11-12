// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket
/**
 * B1S UNLOCK ENGINE v2 â€” script MITM tá»•ng quÃ¡t cá»§a B1sTeam cho toÃ n bá»™ App Premium.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Má»™t file duy nháº¥t do B1sTeam viáº¿t, Ä‘iá»u khiá»ƒn báº±ng cáº¥u hÃ¬nh do worker chÃ¨n vÃ o
 * (worker thay Ä‘Ãºng dÃ²ng `var B1S_CONFIG = { "__B1S_CONFIG__" };`):
 *
 *   var B1S_CONFIG = {
 *     "app":    "vsco",                        // slug app (chá»‰ Ä‘á»ƒ log)
 *     "mode":   "merge" | "replace" | "revenuecat",
 *     "patches": { "data.is_vip": true },      // (merge) set theo Ä‘Æ°á»ng dáº«n "a.b.0.c"
 *     "merge":   { "data": { "vip": true } },  // (merge) deep-merge object
 *     "template": { ... },                     // (replace) thay toÃ n bá»™ body
 *     "entitlements": ["pro"],                 // (revenuecat) entitlement cáº§n báº­t
 *     "products":   ["video.mojo.pro.yearly"],// (revenuecat) product_id cáº§n "Ä‘Ã£ mua"
 *     "urlRules":  [{ "match": "host", "set": { "country_code": "US" } }],
 *     "headers":   { "X-App-Region": "US" },
 *     "deleteHeaders": ["if-none-match"]
 *   };
 *
 * NguyÃªn táº¯c B1sTeam:
 *   Â· KHÃ”NG gá»­i dá»¯ liá»‡u ngÆ°á»i dÃ¹ng Ä‘i Ä‘Ã¢u â€” má»i thay Ä‘á»•i diá»…n ra cá»¥c bá»™ trÃªn mÃ¡y.
 *   Â· License gate fail-closed: key sai / offline (grace 30 ngày; cache 7 ngày) â†’ tráº£ nguyÃªn body gá»‘c.
 *   Â· KhÃ´ng gá»i translate.google.com, khÃ´ng telemetry, khÃ´ng phone-home.
 */
"use strict";

var LICENSE_KEY = "__LICENSE_KEY__";
var B1S_CONFIG = { "__B1S_CONFIG__": 1 };
var B1S_CONFIGS = {"revenuecat-all":{"mode":"revenuecat","entitlements":["Gold","locket_gold","gold","locket.premium.yearly","com.locketgold.vip_yearly","membership","premium","pro"],"products":["locket_1600_1y","locket_199_1m","VSCOANNUAL","FILMX","photoroom_premium","photoroom_yearly","video.mojo.pro.yearly","video.mojo.pro.monthly","video.mojo.pro.weekly"],"patches":{"subscriber.management_url":null}},"youtube-premium":{},"spotify-premium":{"protoRules":[{"has":[1,2],"minVarint":8,"set":{"8":1,"9":0,"10":0,"11":1,"12":0,"13":1,"14":1,"15":1},"onlyExisting":true}],"jsonPatches":{"product":"premium","plan":"premium","subscription.plan":"premium","subscription.product":"premium","isPremium":true,"hasPremium":true,"shuffle":true,"onDemand":true,"ads":false,"ad":false},"urlRules":[{"match":"com:443","replace":["com:443","com"]},{"match":"platform=iphone","replace":["platform=iphone","platform=ipad"]}]},"soundcloud-go-plus":{"mode":"merge","merge":{"plan":{"vendor":"apple","id":"high_tier","manageable":true,"plan_upsells":[],"plan_id":"go-plus","upsells":[],"plan_name":"SoundCloud Go+"},"features":[{"name":"offline_sync","enabled":true,"plans":["mid_tier","high_tier"]},{"name":"no_audio_ads","enabled":true,"plans":["mid_tier","high_tier"]},{"name":"hq_audio","enabled":true,"plans":["high_tier"]},{"name":"system_playlist_in_library","enabled":true,"plans":[]},{"name":"ads_krux","enabled":false,"plans":[]},{"name":"new_home","enabled":true,"plans":[]},{"name":"spotlight","enabled":false,"plans":[]},{"name":"content_reporting","enabled":false,"plans":[]},{"name":"content_reporting_dsa","enabled":false,"plans":[]}]}},"vsco":{"mode":"revenuecat","entitlements":["membership"],"products":["VSCOANNUAL","FILMX"],"patches":{"subscriber.entitlements.membership.product_identifier":"VSCOANNUAL","subscriber.management_url":null}},"alightmotion":{"mode":"replace","template":{"result":{"result":"success","msTime":4102444800000,"accountCreatedMillis":null,"licenses":[{"benefits":["RemoveWatermark","MemberEffects","ProjectPackageSharing","FutureMemberFeatures","AdvancedEasing","CameraObjects","LayerParenting","CloudStorageLowTier"],"type":"subscription","store":"apple_app_store","autoRenewing":true,"orderNumber":"730002548422566","productId":"alightcreative.motion.1y_t60_1w_choose_your_bundle","period":"1y","label":null,"details":null,"expires":4102444800000,"valid":true,"linkStatus":"linked-current"}],"warnings":[]}}},"picsart":{"mode":"merge","variants":[{"match":"storages","mode":"replace","template":{"response":{"totalStorageSizeInBytes":0,"storageLimitSizeInBytes":107374182400,"foldersCountLimit":-1,"totalFoldersCount":0},"status":"success"}},{"match":"purchases","mode":"replace","template":{"status":"success","response":[{"status":"SUBSCRIPTION_RENEWED","is_trial":false,"order_id":"2000001108782321","expire_date":4102444800000,"purchase_date":1704758400000,"subscription_id":"com.picsart.studio.subscription_pro_3_yearly","original_order_id":"2000000756285050","plan_meta":{"permissions":["premium_tools_standard","premium_tools_ai"],"auto_renew_product_id":"com.picsart.studio.subscription_mac_tier1_pro_yearly","level":2000,"storage_limit_in_mb":102400,"id":"com.picsart.studio.subscription_pro_3_yearly","frequency":"yearly","type":"renewable","scope_id":"full","product_id":"com.picsart.studio.subscription_pro_3_yearly","tier_id":"pro"},"limitation":{"max_count":10,"limits_exceeded":false},"is_eligible_for_introductory":false,"reason":"ok"}]}}]},"wink":{"mode":"merge","merge":{"data":{"active_sub_type":2,"account_type":1,"sub_type_name":"renew","active_sub_order_id":"7069961436604422668","trial_period_invalid_time":"","current_order_invalid_time":"4102444800000","active_order_id":"7069961436340181123","limit_type":0,"active_sub_type_name":"renew","use_vip":true,"have_valid_contract":true,"derive_type_name":"Member","derive_type":1,"in_trial_period":false,"is_vip":true,"membership":{"id":"4","display_name":"Wink Member","level":1,"level_name":"Member"},"active_promotion_status_list":[2],"sub_type":2,"account_id":"1230010086","invalid_time":"4102444800000","valid_time":"1546992000000","active_product_id":"0","active_promotion_status":2,"show_renew_flag":true}}},"truecaller":{"mode":"merge","variants":[{"match":"products/apple","mode":"replace","template":{"tier":[{"id":"goldfamily","product":[{"productType":"SubsYearly","id":"apple_gold_family_yearly_v0_shop-0176","sku":"apple_gold_family_yearly_v0","contentType":"subscription","rank":6,"paymentProvider":"Apple","clientProductMetadata":{"selectionRank":5,"displayOrder":5,"isEntitledPremiumScreenProduct":true}}],"feature":[{"id":"live_lookup","rank":1,"status":"Included","isFree":false},{"id":"auto_spam_block","rank":2,"status":"Included","isFree":false},{"id":"series_blocking","rank":3,"status":"Included","isFree":false},{"id":"no_ads","rank":4,"status":"Included","isFree":false},{"id":"extended_spam_blocking","rank":5,"status":"Included","isFree":false},{"id":"advanced_caller_id","rank":6,"status":"Included","isFree":false},{"id":"verified_badge","rank":7,"status":"Included","isFree":false},{"id":"spam_stats","rank":8,"status":"Included","isFree":false},{"id":"call_alert","rank":9,"status":"Included","isFree":false},{"id":"premium_feature","rank":12,"status":"Included","isFree":false},{"id":"identifai","rank":15,"status":"Included","isFree":false},{"id":"siri_search","rank":16,"status":"Included","isFree":false},{"id":"who_viewed_my_profile","rank":17,"status":"Included","isFree":false},{"id":"who_searched_for_me","rank":18,"status":"Included","isFree":false},{"id":"contact_request","rank":19,"status":"Included","isFree":false},{"id":"incognito_mode","rank":20,"status":"Included","isFree":false},{"id":"premium_badge","rank":21,"status":"Included","isFree":false},{"id":"premium_app_icon","rank":22,"status":"Included","isFree":false},{"id":"ghost_call","rank":23,"status":"Included","isFree":false},{"id":"live_chat_support","rank":24,"status":"Included","isFree":false},{"id":"call_recording","rank":25,"status":"Excluded","isFree":false},{"id":"premium_support","rank":25,"status":"Excluded","isFree":false},{"id":"family_sharing","rank":26,"status":"Included","isFree":false},{"id":"gold_caller_id","rank":27,"status":"Included","isFree":false},{"id":"announce_call","rank":28,"status":"Excluded","isFree":false},{"id":"caller_id","rank":29,"status":"Included","isFree":true},{"id":"spam_blocking","rank":30,"status":"Included","isFree":true},{"id":"whatsapp_caller_id","rank":31,"status":"Excluded","isFree":false}],"rank":5}]}},{"match":"subscriptions/status","mode":"replace","template":{"expire":"9999-01-09T01:01:01Z","start":"2024-01-09T02:32:04Z","paymentProvider":"Apple","isExpired":false,"isGracePeriodExpired":false,"subscriptionStatus":"SUBSCRIBED","inAppPurchaseAllowed":true,"product":{"id":"apple_gold_family_yearly_v0_shop-0176","sku":"apple_gold_family_yearly_v0","contentType":"subscription","productType":"SubsYearly","isFreeTrial":false},"tier":{"id":"goldfamily","feature":[{"id":"live_lookup","rank":1,"status":"Included","isFree":false},{"id":"auto_spam_block","rank":2,"status":"Included","isFree":false},{"id":"series_blocking","rank":3,"status":"Included","isFree":false},{"id":"no_ads","rank":4,"status":"Included","isFree":false},{"id":"extended_spam_blocking","rank":5,"status":"Included","isFree":false},{"id":"advanced_caller_id","rank":6,"status":"Included","isFree":false},{"id":"verified_badge","rank":7,"status":"Included","isFree":false},{"id":"spam_stats","rank":8,"status":"Included","isFree":false},{"id":"call_alert","rank":9,"status":"Included","isFree":false},{"id":"premium_feature","rank":12,"status":"Included","isFree":false},{"id":"identifai","rank":15,"status":"Included","isFree":false},{"id":"siri_search","rank":16,"status":"Included","isFree":false},{"id":"who_viewed_my_profile","rank":17,"status":"Included","isFree":false},{"id":"who_searched_for_me","rank":18,"status":"Included","isFree":false},{"id":"contact_request","rank":19,"status":"Included","isFree":false},{"id":"incognito_mode","rank":20,"status":"Included","isFree":false},{"id":"premium_badge","rank":21,"status":"Included","isFree":false},{"id":"premium_app_icon","rank":22,"status":"Included","isFree":false},{"id":"ghost_call","rank":23,"status":"Included","isFree":false},{"id":"live_chat_support","rank":24,"status":"Included","isFree":false},{"id":"call_recording","rank":25,"status":"Excluded","isFree":false},{"id":"premium_support","rank":25,"status":"Excluded","isFree":false},{"id":"family_sharing","rank":26,"status":"Included","isFree":false},{"id":"gold_caller_id","rank":27,"status":"Included","isFree":false},{"id":"announce_call","rank":28,"status":"Excluded","isFree":false},{"id":"caller_id","rank":29,"status":"Included","isFree":true},{"id":"spam_blocking","rank":30,"status":"Included","isFree":true},{"id":"whatsapp_caller_id","rank":31,"status":"Excluded","isFree":false}]}}}]},"lightroom":{"mode":"merge","merge":{"entitlement":{"status":"subscriber","storage":{"used":0,"limit":1154487209165,"display_limit":1099511627776,"warn":992137445376}},"current_subs":{"product_id":"lightroom","store":"adobe","purchase_date":"2019-10-10T16:32:10.254954Z","sao":{"inpkg_CCES":"0","inpkg_CCLE":"1","inpkg_CCSN":"0","inpkg_CCSV":"0","inpkg_LCCC":"0","inpkg_LPES":"0","inpkg_LRBRL":"0","inpkg_LRMAC":"0","inpkg_LRMC":"0","inpkg_LRMP":"0","inpkg_LRTB":"0","inpkg_PHLT":"0","inpkg_PHLT2":"0","inpkg_PLES":"0","storage_quota":"100"}},"avatar":{"placeholder":true}}},"kinemaster":{"mode":"replace","template":{"is_valid_device":true,"has_valid_subscription":true,"expiration_date_ms":4102444800000,"is_table_resettable":true,"subscription_product_id":"com.kinemaster.sub.annual.ia2","state_code":0}},"camscanner":{"mode":"merge","merge":{"data":{"psnl_vip_property":{"group1_paid":1,"ms_first_pay":0,"vip_type":"svip","auto_renewal":true,"in_trial":1,"members_page":0,"pc_vip":1,"renew_type":"year","renew_method":"appstore","ys_first_pay":0,"initial_tm":"32662137600","product_id":"com.intsig.camscanner.premiums.oneyear.autorenewable.free.test1","vip_level_info":{"score":0,"level":0,"next_score":1,"start_score":0,"create_time":0},"nxt_renew_tm":"32662137600","last_payment_method":"appstore","grade":2,"svip":1,"expiry":32662137600,"pending":0,"level_info":{"level":1,"end_days":30,"days":1},"inherited_flag":0,"group2_paid":0},"fax_balance":"99999","used_points":"99999","points":"99999","pdfword_balance":"100010","bookmode_balance":100010,"immt_expy_points":"99999","ocr_balance":99999,"no_login_ocr_balance":"99999","CamScanner_RoadMap":100000}},"variants":[{"match":"queryProperty","merge":{"data":{"ar_property":{"psnl_vip_property":{"group1_paid":1,"ms_first_pay":0,"vip_type":"svip","auto_renewal":true,"in_trial":1,"members_page":0,"pc_vip":1,"renew_type":"year","renew_method":"appstore","ys_first_pay":0,"initial_tm":"32662137600","product_id":"com.intsig.camscanner.premiums.oneyear.autorenewable.free.test1","vip_level_info":{"score":0,"level":0,"next_score":1,"start_score":0,"create_time":0},"nxt_renew_tm":"32662137600","last_payment_method":"appstore","grade":2,"svip":1,"expiry":32662137600,"pending":0,"level_info":{"level":1,"end_days":30,"days":1},"inherited_flag":0,"group2_paid":0}}}}},{"match":"getPrivilegeItem","merge":{"data":{"data":{"document":[{"balance":-1,"item":"CamScanner_Pic2pdf"},{"balance":-1,"item":"CamScanner_PdfCompress"},{"balance":-1,"item":"CamScanner_PdfEncrypt"},{"balance":99999,"item":"CamScanner_Profile_Card_Format"},{"balance":-1,"item":"CamScanner_BookMode"},{"balance":-1,"item":"CamScanner_CertMode"},{"balance":-1,"item":"CamScanner_HDScan"},{"balance":99999,"item":"CamScanner_CloudOCR"}],"pure":[{"balance":-1,"item":"CamScanner_IP_REMOVEAD"}]}}}}]},"beautyplus":{"mode":"replace","template":{"vip_expires_date":4071600000,"message":"success","data":{"points":999999999,"next_claim":1,"gid":"2641810920","balance":999999999,"created_at":1707331696}}},"meitu-xiuxiu":{"mode":"merge","force":[{"pattern":"^(is_?vip|isVip|vip_status|vipStatus|is_premium|premium|has_vip|use_vip|is_member|isMember)$","value":true},{"pattern":"^(vip_expire|vip_expire_time|expire_time|expiration_time|expireDate|expire_date|invalid_time|current_order_invalid_time|vip_end_time)$","value":4102444800000},{"pattern":"^(vip_level|vipLevel|level)$","value":99}]},"snow":{"mode":"merge","merge":{"result":{"products":[{"managed":true,"status":"ACTIVE","startDate":1700000000000,"productId":"com.snowcorp.epic.subscribe.plan.oneyear","expireDate":4102444800000},{"managed":true,"status":"ACTIVE","startDate":1700000000000,"productId":"com.campmobile.snow.subscribe.oneyear","expireDate":4102444800000},{"managed":true,"status":"ACTIVE","startDate":1700000000000,"productId":"com.campmobile.snow.subscribe.plan.oneyear","expireDate":4102444800000}],"tickets":[{"managed":true,"status":"ACTIVE","startDate":1700000000000,"productId":"com.snowcorp.epic.subscribe.plan.oneyear","expireDate":4102444800000},{"managed":true,"status":"ACTIVE","startDate":1700000000000,"productId":"com.campmobile.snow.subscribe.oneyear","expireDate":4102444800000}],"activated":true}}},"capcut":{"mode":"merge","patches":{"data.is_vip":true,"data.vip_status":1,"data.vip_expire_time":4102444800000,"data.is_team_vip":true,"data.team_vip_status":1,"data.space_vip_status":1,"data.vip_info.is_vip":true,"data.vip_info.vip_status":1,"data.vip_info.status":1,"data.vip_info.expired_time":4102444800000,"data.space_info.is_vip":true,"data.space_info.vip_status":1,"data.space_info.capacity":10995116277760,"data.space_info.used_capacity":0,"data.space_info.expired_time":4102444800000,"data.team_info.is_vip":true,"data.team_info.vip_status":1,"data.team_info.role":1,"user_info.is_vip":true,"user_info.vip_status":1,"config.enable_4k":true,"config.max_resolution":"4k","config.watermark_enable":false,"config.export_hd":true},"force":[{"pattern":"^(is_?vip|isVip|vip_status|is_team_vip|is_pro|isPremium)$","value":true},{"pattern":"^(vip_expire|vip_expire_time|expire_time|expired_time|expiration)$","value":4102444800000}]},"photoroom":{"mode":"revenuecat","entitlements":["premium"],"products":["photoroom_premium","photoroom_yearly","premium"]},"toonme":{"mode":"replace","template":{"receipt":{"receipt_type":"Production","app_item_id":1507840123,"receipt_creation_date":"2024-01-01 00:00:00 Etc/GMT","bundle_id":"com.photofun.toonme","original_purchase_date":"2020-09-09 01:01:59 Etc/GMT","in_app":[{"quantity":"1","purchase_date_ms":"1704067200000","transaction_id":"350001102215974","is_trial_period":"false","original_transaction_id":"350001102215974","purchase_date":"2024-01-01 00:00:00 Etc/GMT","product_id":"premium_yearly","in_app_ownership_type":"PURCHASED","original_purchase_date_ms":"1704067200000","original_purchase_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","purchase_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","original_purchase_date":"2024-01-01 00:00:00 Etc/GMT"},{"quantity":"1","purchase_date_ms":"1704067200000","transaction_id":"350001102215975","is_trial_period":"false","original_transaction_id":"350001102215975","purchase_date":"2024-01-01 00:00:00 Etc/GMT","product_id":"toonme_premium_yearly","in_app_ownership_type":"PURCHASED","original_purchase_date_ms":"1704067200000","original_purchase_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","purchase_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","original_purchase_date":"2024-01-01 00:00:00 Etc/GMT"}],"adam_id":1507840123,"request_date":"2024-01-01 00:00:00 Etc/GMT","version_external_identifier":846803077,"application_version":"202401010001","download_id":75077048258874},"status":0,"environment":"Production"}},"mojo":{"mode":"revenuecat","entitlements":["pro"],"products":["video.mojo.pro.yearly","video.mojo.pro.monthly","video.mojo.pro.weekly"]},"photoshop-express":{"mode":"merge","patches":{"mobileProfile.profileStatus":"PROFILE_AVAILABLE","mobileProfile.legacyProfile":"{}","mobileProfile.relationshipProfile":"[]"}},"piccollage":{"mode":"merge","merge":{"data":{"app_receipt":{"verified_at":"2024-01-01T11:02:19+00:00","intro_offer_used_product_ids":["com.cardinalblue.PicCollage.subscription.annual.promotion"],"pending_renewal_info":{"edges":[{"node":{"product_id":"com.cardinalblue.PicCollage.subscription.annual.promotion","auto_renew_status":true,"expiration_intent":null}}]},"purchases":{"edges":[{"node":{"product_id":"com.cardinalblue.PicCollage.subscription.annual.promotion","transaction_id":"190001274994143","purchased_at":"2024-01-01T11:02:14+00:00","expires_at":"2099-05-02T11:02:14+00:00","verified_at":"2024-01-01T11:02:19+00:00","canceled_at":null,"is_trial_period":false,"is_in_intro_offer_period":false}}]},"is_free_trial_eligible":false}}}},"smallpdf":{"mode":"merge","merge":{"success":true,"data":{"email_verified":true,"app_metadata":{"mobile_user":true,"is_in_free_trial_period":false,"expirationDate":"2099-04-16","signedUp":true,"canceled":false,"free_trial_series_sent_at":"2024-01-01T08:46:56Z","free_trial_series":"email_trial_original","subscription_platform":"ios","free_trial_user":false,"trial_duration":"1000","grace_period":16,"has_business_email":true,"lock":"0001-01-01T00:00:00Z","is_migrated_keycloak":true,"disputes":{},"subscription":{"previous_platforms":{}}}}}},"ilovepdf":{"mode":"merge","merge":{"premium":true,"sus_rbt":true,"limits":{"merge":{"mb":4000,"files":500},"split":{"mb":4000,"files":1},"compress":{"mb":4000,"files":10},"officepdf":{"mb":4000,"files":10},"wordpdf":{"mb":4000,"files":10},"powerpointpdf":{"mb":4000,"files":10},"excelpdf":{"mb":4000,"files":10},"pdfword":{"mb":4000,"files":10},"pdfpowerpoint":{"mb":4000,"files":10},"pdfexcel":{"mb":4000,"files":10,"pages":400},"pdfoffice":{"mb":4000,"files":10},"pdfjpg":{"mb":4000,"files":10},"imagepdf":{"mb":4000,"files":80},"pagenumber":{"mb":4000,"files":10},"watermark":{"mb":4000,"files":10},"rotate":{"mb":4000,"files":80},"unlock":{"mb":4000,"files":10},"compressimage":{"mb":4000,"files":120},"cropimage":{"mb":4000,"files":1},"converttojpg":{"mb":4000,"files":120},"convertfromjpg":{"mb":4000,"files":120},"rotateimage":{"mb":4000,"files":120},"watermarkimage":{"mb":4000,"files":120},"memeimage":{"mb":4000,"files":1},"editimage":{"mb":50,"files":1},"editpdf":{"mb":100,"files":1},"sign":{"mb":50,"files":5}}}},"tokcam":{"mode":"replace","template":{"receipt":{"receipt_type":"Production","app_item_id":1522192046,"receipt_creation_date":"2024-01-01 00:00:00 Etc/GMT","bundle_id":"com.muyin.camera","original_purchase_date":"2020-09-09 01:01:59 Etc/GMT","in_app":[{"quantity":"1","purchase_date_ms":"1642850859000","transaction_id":"350001102215973","is_trial_period":"false","original_transaction_id":"350001102215973","purchase_date":"2024-01-01 00:00:00 Etc/GMT","product_id":"incentive01","in_app_ownership_type":"PURCHASED","original_purchase_date_ms":"1642850859000","original_purchase_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","purchase_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","original_purchase_date":"2024-01-01 00:00:00 Etc/GMT"}],"adam_id":1522192046,"receipt_creation_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","request_date":"2024-01-01 00:00:00 Etc/GMT","request_date_pst":"2024-01-01 00:00:00 America/Los_Angeles","version_external_identifier":846803077,"request_date_ms":"1704067200000","original_purchase_date_pst":"2020-09-08 18:01:59 America/Los_Angeles","application_version":"202401010001","original_purchase_date_ms":"1599613319000","receipt_creation_date_ms":"1704067180000","original_application_version":"2020090601","download_id":75077048258874},"status":0,"environment":"Production"}}};

/* B1S-CDN-ARG: module má»›i (CDN jsDelivr) truyá»n "KEY|slug" qua $argument â€” khÃ´ng chá»©a dáº¥u pháº©y.
   Module cÅ©: worker vÃ¡ 2 dÃ²ng placeholder á»Ÿ trÃªn â€” giá»¯ tÆ°Æ¡ng thÃ­ch ngÆ°á»£c. */
try {
  var _rawArg = (typeof $argument !== "undefined" && $argument) ? String($argument) : "";
  var _argParts = _rawArg.split("|");
  var _argKey = (_argParts[0] || "").trim().toUpperCase();
  if (/^B1S-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(_argKey)) LICENSE_KEY = _argKey;
  var _argSlug = (_argParts[1] || "").trim().toLowerCase();
  if (typeof B1S_CONFIGS !== "undefined" && _argSlug && Object.prototype.hasOwnProperty.call(B1S_CONFIGS, _argSlug)) {
    B1S_CONFIG = B1S_CONFIGS[_argSlug];
  }
} catch (_e) { /* giá»¯ giÃ¡ trá»‹ worker chÃ¨n (module cÅ©) */ }

var FAR_FUTURE = "2099-12-31T23:59:59Z";
var FAR_FUTURE_MS = 4102444800000; // 2100-01-01
var PAST = "2024-01-01T00:00:00Z";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• License gate (fail-closed) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var memDeviceId = null;

function deviceId() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) {
      var id1 = $prefs.valueForKey("b1s_lg_device_id");
      if (id1) return id1;
      id1 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $prefs.setValueForKey(id1, "b1s_lg_device_id");
      return id1;
    }
  } catch (e) { /* tiáº¿p tá»¥c */ }
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore) {
      var id2 = $persistentStore.read("b1s_lg_device_id");
      if (id2) return id2;
      id2 = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      $persistentStore.write(id2, "b1s_lg_device_id");
      return id2;
    }
  } catch (e) { /* tiáº¿p tá»¥c */ }
  if (!memDeviceId) memDeviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return memDeviceId;
}

function lastVerifiedAt() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) return Number($prefs.valueForKey("b1s_lg_ok_at") || 0);
  } catch (e) { /* bá» qua */ }
  return 0;
}

/** OFFLINE-GRACE: mÃ¡y tá»«ng verify OK trong â‰¤30 ngÃ y nhÆ°ng láº§n nÃ y verify lá»—i (máº¥t máº¡ng/mÃ¡y chá»§ táº¡m thá»i) â†’ váº«n cho má»Ÿ, trÃ¡nh "máº¥t key" giá»¯a chá»«ng. */
var OFFLINE_GRACE_MS = 2592000000;
function offlineGraceActive() {
  var last = lastVerifiedAt();
  return last > 0 && Date.now() - last < OFFLINE_GRACE_MS;
}
function markVerified() {
  try {
    if (typeof $prefs !== "undefined" && $prefs) $prefs.setValueForKey(String(Date.now()), "b1s_lg_ok_at");
  } catch (e) { /* bá» qua */ }
}

function gate(doAllow, doDeny) {
  if (!LICENSE_KEY || LICENSE_KEY.indexOf("__LICENSE_KEY__") === 0 || LICENSE_KEY.length < 8) return doDeny();
  if (Date.now() - lastVerifiedAt() < 604800000) return doAllow(); // 7 ngÃ y cache
  var id = deviceId();
  if (!id) return doDeny();

  function verifyWith(base, onDone) {
    if (typeof $httpClient === "undefined" || !$httpClient) return onDone(false);
    $httpClient.get(
      {
        url: base + "?key=" + encodeURIComponent(LICENSE_KEY) + "&device_id=" + encodeURIComponent(id),
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        },
        timeout: 10,
      },
      function (err, response, data) {
        if (err) return onDone(false);
        var body = "";
        if (typeof data === "string") body = data;
        else if (typeof data !== "undefined" && data !== null) {
          try { body = String(data); } catch (e) { return onDone(false); }
        } else if (response && typeof response.body === "string") body = response.body;
        if (!body) return onDone(false);
        try {
          var j = JSON.parse(body);
          return onDone(Boolean(j && j.valid === true));
        } catch (e) {
          return onDone(false);
        }
      }
    );
  }

  verifyWith("https://locket.b1s.id.vn/api/v2/locketgold/verify", function (ok) {
    if (ok) { markVerified(); return doAllow(); }
    if (offlineGraceActive()) { try { console.log("[b1sunlock] OFFLINE-GRACE"); } catch (e) {} return doAllow(); }
    return doDeny();
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Helpers â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

/** Set giÃ¡ trá»‹ theo Ä‘Æ°á»ng dáº«n "a.b.0.c"; "*" = Ã¡p dá»¥ng cho má»i pháº§n tá»­ máº£ng. */
function setPath(root, path, value) {
  var parts = String(path).split(".");
  var node = root;
  for (var i = 0; i < parts.length - 1; i++) {
    var key = parts[i];
    var nextKey = parts[i + 1];
    if (Array.isArray(node)) {
      if (key === "*") {
        for (var a = 0; a < node.length; a++) setPath(node[a], parts.slice(i + 1).join("."), value);
        return true;
      }
      var idx = parseInt(key, 10);
      if (isNaN(idx) || idx < 0 || idx >= node.length) return false;
      node = node[idx];
      continue;
    }
    if (!isObject(node)) return false;
    if (!Object.prototype.hasOwnProperty.call(node, key)) {
      node[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    node = node[key];
  }
  var last = parts[parts.length - 1];
  if (Array.isArray(node)) {
    if (last === "*") {
      for (var b = 0; b < node.length; b++) node[b] = value;
      return true;
    }
    var li = parseInt(last, 10);
    if (isNaN(li) || li < 0 || li >= node.length) return false;
    node[li] = value;
    return true;
  }
  if (!isObject(node)) return false;
  node[last] = value;
  return true;
}

/** Deep-merge object (máº£ng bá»‹ thay tháº¿, khÃ´ng ná»‘i). */
function deepMerge(target, src) {
  if (!isObject(src)) return target;
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    var v = src[k];
    if (isObject(v)) {
      if (!isObject(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

/** RevenueCat: báº­t entitlement + giáº£ product "Ä‘Ã£ mua" (vÄ©nh viá»…n).
 *  B1sTeam: báº­t Táº¤T Cáº¢ entitlement/subscription Ä‘ang cÃ³ sáºµn trong response (khÃ´ng cáº§n Ä‘oÃ¡n
 *  tÃªn product) + thÃªm cÃ¡c tÃªn Ä‘Æ°á»£c cáº¥u hÃ¬nh Ä‘á»ƒ app tá»± nháº­n ra gÃ³i. */
function applyRevenueCat(obj, cfg) {
  if (!isObject(obj)) return false;
  var sub = isObject(obj.subscriber) ? obj.subscriber : null;
  if (!sub) return false;
  var far = cfg.farFuture || FAR_FUTURE;
  var ents = isObject(sub.entitlements) ? sub.entitlements : (sub.entitlements = {});
  var subs = isObject(sub.subscriptions) ? sub.subscriptions : (sub.subscriptions = {});
  var non = isObject(sub.non_subscriptions) ? sub.non_subscriptions : (sub.non_subscriptions = {});

  function activateEntitlement(name) {
    var cur = isObject(ents[name]) ? ents[name] : {};
    cur.expires_date = far;
    cur.expiration_date = far;
    if (!cur.purchase_date) cur.purchase_date = PAST;
    if (!cur.original_purchase_date) cur.original_purchase_date = PAST;
    cur.is_active = true;
    cur.active = true;
    cur.ownership_type = "PURCHASED";
    cur.store = "app_store";
    cur.period_type = "normal";
    cur.is_sandbox = false;
    cur.unsubscribe_detected_at = null;
    cur.billing_issues_detected_at = null;
    cur.grace_period_expires_date = null;
    if (!cur.product_identifier) cur.product_identifier = name;
    ents[name] = cur;
  }
  function activateProduct(pid) {
    var s = isObject(subs[pid]) ? subs[pid] : {};
    s.ownership_type = "PURCHASED";
    s.store = "app_store";
    s.is_sandbox = false;
    s.expires_date = far;
    if (!s.purchase_date) s.purchase_date = PAST;
    if (!s.original_purchase_date) s.original_purchase_date = PAST;
    s.period_type = "normal";
    s.display_name = pid;
    s.auto_resume_date = null;
    s.refunded_at = null;
    s.billing_issues_detected_at = null;
    s.unsubscribe_detected_at = null;
    s.grace_period_expires_date = null;
    subs[pid] = s;
    non[pid] = {
      purchase_date: s.purchase_date,
      original_purchase_date: s.original_purchase_date,
      expires_date: far,
      ownership_type: "PURCHASED",
      store: "app_store",
      is_sandbox: false,
    };
  }

  // 1) Báº­t má»i entitlement Ä‘ang cÃ³ trong response
  for (var existing in ents) {
    if (!Object.prototype.hasOwnProperty.call(ents, existing)) continue;
    activateEntitlement(existing);
  }
  // 2) Báº­t má»i subscription Ä‘ang cÃ³ trong response
  for (var exSub in subs) {
    if (!Object.prototype.hasOwnProperty.call(subs, exSub)) continue;
    activateProduct(exSub);
  }
  // 3) ThÃªm cÃ¡c tÃªn Ä‘Æ°á»£c cáº¥u hÃ¬nh (app tá»± nháº­n gÃ³i dÃ¹ server chÆ°a tráº£ vá»)
  var list = cfg.entitlements || [];
  for (var i = 0; i < list.length; i++) activateEntitlement(list[i]);
  var products = cfg.products || [];
  for (var j = 0; j < products.length; j++) activateProduct(products[j]);

  sub.management_url = null;
  return true;
}

/** Ã‰p má»i key khá»›p regex â†’ giÃ¡ trá»‹ cá»‘ Ä‘á»‹nh (Ä‘á»‡ quy toÃ n payload). */
function applyForce(node, rules, depth) {
  if (!node || typeof node !== "object" || (depth || 0) > 12) return false;
  var changed = false;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      if (applyForce(node[i], rules, (depth || 0) + 1)) changed = true;
    }
    return changed;
  }
  for (var key in node) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
    var value = node[key];
    if (value && typeof value === "object") {
      if (applyForce(value, rules, (depth || 0) + 1)) changed = true;
      continue;
    }
    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r];
      if (!rule || !rule.pattern) continue;
      var re;
      try { re = new RegExp(rule.pattern, "i"); } catch (e) { continue; }
      if (!re.test(String(key))) continue;
      var target = rule.value;
      if (rule.untilFar && typeof target === "number") target = FAR_FUTURE_MS;
      if (value !== target) { node[key] = target; changed = true; }
      break;
    }
  }
  return changed;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• REQUEST phase â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function applyUrlRules(url) {
  var rules = B1S_CONFIG.urlRules || [];
  if (!rules.length || !url) return url;
  var out = url;
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (!r) continue;
    var match = String(r.match || "");
    if (!match || out.indexOf(match) === -1) continue;
    if (r.replace) {
      out = out.split(String(r.replace[0])).join(String(r.replace[1]));
    }
    if (r.set && isObject(r.set)) {
      var qIdx = out.indexOf("?");
      var base = qIdx === -1 ? out : out.slice(0, qIdx);
      var query = qIdx === -1 ? "" : out.slice(qIdx + 1);
      var pairs = query.length ? query.split("&") : [];
      for (var k in r.set) {
        if (!Object.prototype.hasOwnProperty.call(r.set, k)) continue;
        var found = false;
        for (var p = 0; p < pairs.length; p++) {
          if (pairs[p].split("=")[0] === k) {
            pairs[p] = k + "=" + encodeURIComponent(String(r.set[k]));
            found = true;
            break;
          }
        }
        if (!found) pairs.push(k + "=" + encodeURIComponent(String(r.set[k])));
      }
      out = base + (pairs.length ? "?" + pairs.join("&") : "");
    }
  }
  return out;
}

function applyRequestPhase() {
  var result = {};
  var url = ($request && $request.url) ? String($request.url) : "";
  var newUrl = applyUrlRules(url);
  if (newUrl && newUrl !== url) result.url = newUrl;

  var headers = {};
  var src = ($request && $request.headers) ? $request.headers : {};
  var del = B1S_CONFIG.deleteHeaders || [];
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    var lk = String(k).toLowerCase();
    var skip = false;
    for (var d = 0; d < del.length; d++) {
      if (String(del[d]).toLowerCase() === lk) { skip = true; break; }
    }
    if (skip) continue;
    headers[k] = src[k];
  }
  var setH = B1S_CONFIG.headers || {};
  for (var h in setH) {
    if (!Object.prototype.hasOwnProperty.call(setH, h)) continue;
    headers[h] = setH[h];
  }
  result.headers = headers;
  $done(result);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• RESPONSE phase â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/** Chá»n cáº¥u hÃ¬nh hiá»‡u lá»±c: variant Ä‘áº§u tiÃªn cÃ³ "match" náº±m trong URL, khÃ´ng thÃ¬ dÃ¹ng config gá»‘c. */
function resolveConfig() {
  var variants = B1S_CONFIG.variants || [];
  if (variants.length) {
    var url = ($request && $request.url) ? String($request.url) : "";
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (!v || !v.match) continue;
      if (url.indexOf(String(v.match)) !== -1) {
        // Variant káº¿ thá»«a cÃ¡c field chung cá»§a config gá»‘c
        var merged = {};
        for (var k in B1S_CONFIG) {
          if (!Object.prototype.hasOwnProperty.call(B1S_CONFIG, k)) continue;
          if (k === "variants") continue;
          merged[k] = B1S_CONFIG[k];
        }
        for (var kv in v) {
          if (!Object.prototype.hasOwnProperty.call(v, kv)) continue;
          merged[kv] = v[kv];
        }
        return merged;
      }
    }
  }
  return B1S_CONFIG;
}

function applyResponsePhase() {
  var body = (typeof $response !== "undefined" && $response && $response.body) ? $response.body : "";
  if (!body || typeof body !== "string") { $done({}); return; }

  var cfg = resolveConfig();
  var mode = cfg.mode || "merge";
  var status = ($response && ($response.status || $response.statusCode)) || 200;

  try {
    if (mode === "replace") {
      var tpl = cfg.template;
      if (!isObject(tpl)) { $done({}); return; }
      $done({ status: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(tpl) });
      return;
    }

    var obj = JSON.parse(body);
    var changed = false;

    if (mode === "revenuecat") {
      if (applyRevenueCat(obj, cfg)) changed = true;
    }

    var patches = cfg.patches || {};
    for (var p in patches) {
      if (!Object.prototype.hasOwnProperty.call(patches, p)) continue;
      if (setPath(obj, p, patches[p])) changed = true;
    }

    if (cfg.merge) {
      deepMerge(obj, cfg.merge);
      changed = true;
    }

    if (cfg.force && cfg.force.length) {
      if (applyForce(obj, cfg.force, 0)) changed = true;
    }

    if (!changed) { $done({}); return; }
    $done({ status: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(obj) });
  } catch (e) {
    $done({});
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Entry point â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var IS_REQUEST_PHASE = (typeof $response === "undefined");

if (IS_REQUEST_PHASE) {
  gate(
    function () { applyRequestPhase(); },
    function () { $done({}); }
  );
} else {
  gate(
    function () { applyResponsePhase(); },
    function () { $done({}); }
  );
}
