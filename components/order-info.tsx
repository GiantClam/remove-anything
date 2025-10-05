"use client";

import React, { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import qs from "query-string";

import { UserSubscriptionPlan } from "types";
import Loading from "@/components/loading/index";
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderPhase } from "@/db/type";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import { PricingCards } from "@/components/pricing-cards";
import type { ChargeProductSelectDto } from "@/db/type";

import { Badge } from "./ui/badge";

interface BillingInfoProps extends React.HTMLAttributes<HTMLFormElement> {
  userSubscriptionPlan?: UserSubscriptionPlan;
}

const OrderBadge = {
  [OrderPhase.Paid]: "default",
  [OrderPhase.Canceled]: "Secondary",
  [OrderPhase.Failed]: "destructive",
};
export function OrderInfo() {
  const t = useTranslations("Orders");
  const { userId } = useAuth();
  const [pageParams, setPageParams] = useState({
    page: 1,
    pageSize: 12,
  });
  const [phase, setPhase] = useState<OrderPhase | "all">("all");
  
  // 查询支付记录
  const queryData = useQuery({
    queryKey: ["queryUserOrder", pageParams, phase],
    queryFn: async () => {
      const values = phase === "all" ? {} : { phase };
      const res = await fetch(
        `/api/order?${qs.stringify({
          ...pageParams,
          ...values,
        })}`,
        {
          credentials: 'include', // 使用 cookie 认证而不是 Bearer token
        },
      ).then((res) => res.json());

      return res.data ?? { total: 0 };
    },
  });

  // 查询套餐信息
  const { data: chargeProducts } = useQuery<ChargeProductSelectDto[]>({
    queryKey: ["chargeProducts"],
    queryFn: async () => {
      const res = await fetch("/api/charge-product", {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error("Failed to fetch charge products");
      }
      const data = await res.json();
      return data.data || [];
    },
  });

  const onChangePage = (page: number) => {
    setPageParams({ ...pageParams, page });
  };

  return (
    <main className="grid flex-1 items-start gap-4 py-4 sm:py-0 md:gap-8">
      <Tabs
        defaultValue="pricing"
        className="w-full"
      >
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="pricing">套餐购买</TabsTrigger>
            <TabsTrigger value="history">支付记录</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="pricing" className="mt-6">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">选择套餐购买积分</h2>
              <p className="text-muted-foreground mt-2">无隐藏费用，一次性付款</p>
            </div>
            {chargeProducts && chargeProducts.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-3">
                {chargeProducts.map((offer) => (
                  <div
                    key={offer.id}
                    className="relative flex flex-col overflow-hidden rounded-3xl border shadow-sm"
                  >
                    <div className="min-h-[150px] items-start space-y-4 bg-muted/50 p-6">
                      <p className="flex font-urban text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        {offer.title}
                      </p>
                      <div className="flex flex-row">
                        <div className="flex items-end">
                          <div className="flex text-left text-3xl font-semibold leading-6">
                            {offer.originalAmount && offer.originalAmount > 0 ? (
                              <>
                                <span className="mr-2 text-base text-muted-foreground/80 line-through">
                                  {formatPrice(offer.originalAmount, "$")}
                                </span>
                                <span>{formatPrice(offer.amount, "$")}</span>
                              </>
                            ) : (
                              `${formatPrice(offer.amount, "$")}`
                            )}
                          </div>
                          <div className="-mb-1 ml-2 text-left text-sm font-medium text-muted-foreground">
                            <div>
                              {offer.credit} 积分
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex h-full flex-col justify-between gap-16 p-6">
                      <ul className="space-y-2 text-left text-sm font-medium leading-normal">
                        {offer.message &&
                          offer.message.split(",")?.map((feature) => (
                            <li className="flex items-start gap-x-3" key={feature}>
                              <div className="size-5 shrink-0 text-purple-500">✓</div>
                              <p>{feature}</p>
                            </li>
                          ))}
                      </ul>
                      <div className="flex justify-center">
                        <a
                          href={`/pricing?product=${offer.id}`}
                          className="w-full"
                        >
                          <button
                            className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
                          >
                            立即购买
                          </button>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-96 items-center justify-center">
                <EmptyPlaceholder>
                  <EmptyPlaceholder.Icon name="post" />
                  <EmptyPlaceholder.Title>暂无套餐</EmptyPlaceholder.Title>
                  <EmptyPlaceholder.Description>
                    套餐信息暂时不可用，请稍后再试
                  </EmptyPlaceholder.Description>
                </EmptyPlaceholder>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="mt-6">
          <Tabs
            value={phase}
            onValueChange={(value) => setPhase(value as OrderPhase | "all")}
          >
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="all">{t("order.all")}</TabsTrigger>
                <TabsTrigger value={OrderPhase.Paid}>{t("order.paid")}</TabsTrigger>
                <TabsTrigger value={OrderPhase.Failed}>
                  {t("order.failed")}
                </TabsTrigger>
                <TabsTrigger value={OrderPhase.Canceled} className="hidden sm:flex">
                  {t("order.canceled")}
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card x-chunk="dashboard-06-chunk-0">
                <CardHeader>
                  <CardTitle>{t("title")}</CardTitle>
                  <CardDescription>{t("description")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {queryData.isPending || queryData.isFetching ? (
                    <div className="flex h-full min-h-96 w-full items-center justify-center">
                      <Loading />
                    </div>
                  ) : queryData.isError || queryData?.data?.data?.length <= 0 ? (
                    <div className="flex min-h-96 items-center justify-center">
                      <EmptyPlaceholder>
                        <EmptyPlaceholder.Icon name="post" />
                        <EmptyPlaceholder.Title>
                          {t("empty.title")}
                        </EmptyPlaceholder.Title>
                        <EmptyPlaceholder.Description>
                          {t("empty.description")}
                        </EmptyPlaceholder.Description>
                      </EmptyPlaceholder>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("table.customer")}</TableHead>
                          <TableHead>{t("table.status")}</TableHead>
                          <TableHead>
                            {t("table.amount")}
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            {t("table.credit")}
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            {t("table.channel")}
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            {t("table.createdAt")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {queryData.data?.data?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              <div className="font-medium">
                                {item.user?.name || "用户"}
                              </div>
                              <div className="hidden text-sm text-muted-foreground md:inline">
                                {item.user?.email || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={OrderBadge[item.phase]}>
                                {item.phase}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatPrice(item.amount)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              +{item.credit}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {item.channel}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {formatDate(item.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
                {queryData.data?.total > 0 && (
                  <CardFooter className="justify-between">
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {t("table.total")} <strong>{queryData.data?.total}</strong>
                      &nbsp; {t("table.records")}
                    </div>
                    <Pagination className="justify-end">
                      <PaginationContent>
                        {pageParams.page !== 1 && (
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => onChangePage(pageParams.page - 1)}
                            />
                          </PaginationItem>
                        )}
                        {pageParams.page * pageParams.pageSize <
                          queryData.data?.total && (
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => onChangePage(pageParams.page + 1)}
                            />
                          </PaginationItem>
                        )}
                      </PaginationContent>
                    </Pagination>
                  </CardFooter>
                )}
              </Card>
            </div>
          </Tabs>
        </TabsContent>
      </Tabs>
    </main>
  );
}
