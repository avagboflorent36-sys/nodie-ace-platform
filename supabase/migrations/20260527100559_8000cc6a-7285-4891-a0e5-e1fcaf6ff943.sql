UPDATE public.cohortes SET
  chariow_product_id_full = NULLIF(regexp_replace(chariow_product_id_full, '.*/', ''), ''),
  chariow_product_id_installment_1 = NULLIF(regexp_replace(chariow_product_id_installment_1, '.*/', ''), ''),
  chariow_product_id_installment_2 = NULLIF(regexp_replace(chariow_product_id_installment_2, '.*/', ''), '');