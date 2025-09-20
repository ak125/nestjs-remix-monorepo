export interface PopularProductDto {
  pg_id: string;
  pg_alias: string;
  pg_name: string;
  pg_name_url: string;
  pg_name_meta: string;
  pg_img: string;
  sg_title: string;
  sg_description: string;
  ba_preview: string;
}

export interface PopularProductsResponseDto {
  products: PopularProductDto[];
  success: boolean;
}