import React from "react";
import {
  ForkKnife, ShoppingCart, House, Bus, Car, Heartbeat, GraduationCap,
  GameController, ShoppingBag, Repeat, Receipt, Bank, Airplane, Users,
  DotsThreeOutline, Money, CreditCard, Wallet, Tag,
} from "@phosphor-icons/react";

const MAP = {
  ForkKnife, ShoppingCart, House, Bus, Car, Heartbeat, GraduationCap,
  GameController, ShoppingBag, Bag: ShoppingBag, Repeat, Receipt, Bank,
  Airplane, Users, DotsThree: DotsThreeOutline, Money, CreditCard, Wallet, Tag,
};

export const CategoryIcon = ({ name, size = 20, weight = "duotone", color }) => {
  const Icon = MAP[name] || Tag;
  return <Icon size={size} weight={weight} color={color} />;
};

export default MAP;
